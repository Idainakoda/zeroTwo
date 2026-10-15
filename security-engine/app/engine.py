"""The security pipeline.

Prompt:   normalise → detect PII / secrets / confidential → injection rules →
          (local Llama only if needed) → risk score → decision → redact → re-scan
Response: canary + leak phrases → PII / secrets → redact foreign data → re-hydrate placeholders
Document: per-chunk injection scan → quarantine → redact → spotlight
"""
import asyncio
import re
import time
import uuid
from datetime import datetime, timezone

from app import config, llm_analyzer
from app.detectors import confidential, injection, pii, secrets
from app.detectors.common import value_hash
from app.detectors.ml_injection import ml
from app.rag import store as rag_store
from app.normalizer import normalize
from app.policy import policy
from app.redaction import (new_canary, redact, rehydrate, resolve_overlaps, system_prompt_addon, vault)
from app.schemas import (Category, ChunkVerdict, Decision, DocumentAnalysis, DocumentRequest, Finding,
                         LayerTiming, LlmVerdict, PromptAnalysis, PromptRequest, ResponseAnalysis,
                         ResponseRequest, UserContext)

SEVERITY_POINTS = {1: 5, 2: 15, 3: 30, 4: 45}
PERSONAL = {Category.PII, Category.FINANCIAL}
DOC_QUARANTINE_SCORE = 0.45


def _ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 2)


def fuse_injection(rules: float, semantic: float, classifier: float, educational: bool) -> float:
    """Noisy-OR of the three layers. Educational / defensive framing halves the ML part
    (rules have their own dampening), so 'explain prompt injection' is not blocked."""
    ml_factor = 0.5 if educational else 1.0
    parts = [rules, config.W_SEMANTIC * semantic * ml_factor, config.W_CLASSIFIER * classifier * ml_factor]
    p = 1.0
    for x in parts:
        p *= 1 - x
    return round(min(0.99, 1 - p), 3)


CODE_LINE = re.compile(r"[=(){}\[\];]|^\s{2,}\S|^\s*(?:def|import|from|class|if|return|for|while|public|const|let|var)\b")


def looks_like_code(text: str) -> bool:
    lines = [ln for ln in text.splitlines() if ln.strip()]
    return len(lines) >= 2 and sum(bool(CODE_LINE.search(ln)) for ln in lines) / len(lines) >= 0.4


def is_educational(clean_text: str) -> bool:
    return bool(injection.EDUCATIONAL.search(clean_text)) and not re.search(r"\b(?:your|ur)\b", clean_text)


def _injection_layers(text: str, norm, inj, has_maskable: bool = False) -> tuple[float, dict, list[Finding], float]:
    """Runs the ML layers and returns (fused score, per-layer scores, extra findings, ml ms).

    has_maskable: the prompt contains personal data / secrets that will be masked. The classifier
    reacts to such values themselves (a password sentence can score 1.0), so - as on code - it can
    then only push the prompt into the grey zone, never block it on its own.
    """
    if not ml.ready:
        return inj.score, {"rules": inj.score, "semantic": None, "classifier": None, "fused": inj.score}, [], 0.0
    t = time.perf_counter()
    texts = [text] + ([norm.views["decoded"]] if "decoded" in norm.views else [])
    res = ml.analyze(texts)
    educational = is_educational(norm.views["clean"])
    # The classifier often mistakes source code / config snippets for injections, so on
    # code-like text it can only push the prompt into the grey zone (local Llama), not block.
    code = looks_like_code(text)
    if code or has_maskable:
        res.classifier = round(res.classifier * 0.5, 3)
    fused = fuse_injection(inj.score, res.semantic, res.classifier, educational)
    extra: list[Finding] = []
    # On code, weak ML signals are noise; list them only when they could change the decision.
    sem_min, clf_min = (0.5, 0.6) if code else (0.3, 0.5)
    if res.semantic >= sem_min:
        extra.append(Finding(category=Category.INJECTION, type=res.semantic_label or "SEMANTIC_MATCH",
                             severity=4 if res.semantic >= 0.7 else 3, confidence=res.semantic,
                             detector="semantic-similarity",
                             reason=f"close to known attack (similarity {res.nearest_attack:.2f}, "
                                    f"nearest legitimate {res.nearest_benign:.2f})"))
    if res.classifier >= clf_min:
        extra.append(Finding(category=Category.INJECTION, type="ML_CLASSIFIER_INJECTION",
                             severity=4 if res.classifier >= 0.9 else 3, confidence=res.classifier,
                             detector="deberta-classifier", reason=f"classifier probability {res.classifier:.2f}"))
    layers = {"rules": inj.score, "semantic": res.semantic, "classifier": res.classifier if ml.classifier else None,
              "nearest_attack_similarity": res.nearest_attack, "educational_framing": educational,
              "code_like": code, "classifier_damped": code or has_maskable, "fused": fused}
    return fused, layers, extra, _ms(t)


def _still_suspicious_without_judge(masked_text: str, layers: dict, inj, norm) -> bool:
    """With no local judge, decide whether a grey-zone prompt must fail closed.

    The classifier alone (rules and semantic layer quiet) is not enough when:
    - the text is code / config: it is known to misfire there, which is why its score is
      already halved for code;
    - the prompt contains values the gateway masks: the classifier reacts to key-like tokens
      and to the <TYPE_n> placeholders themselves (a password prompt scores 0.03, its masked
      copy 0.99), so on such prompts it measures the secret, not an attack.
    Any rule or semantic signal, obfuscation or hidden characters still fail closed.
    """
    rules = layers.get("rules") or 0.0
    semantic = layers.get("semantic") or 0.0
    classifier_only = rules < config.INJECTION_GREY_LOW and semantic < config.INJECTION_GREY_LOW
    has_masked_values = masked_text != norm.original
    if (classifier_only and (layers.get("code_like") or has_masked_values)
            and not inj.obfuscated and not norm.hidden_chars):
        return False
    if has_masked_values:
        # Judge what would actually be forwarded, with neutral words instead of placeholder tags.
        neutral = re.sub(r"<[A-Z_]+_\d+>", "value", masked_text)
        masked_norm = normalize(neutral)
        masked_score, _, _, _ = _injection_layers(neutral, masked_norm, injection.scan(masked_norm))
        if masked_score < config.INJECTION_GREY_LOW:
            return False
    return True


def _detect_data(text: str) -> list[Finding]:
    return resolve_overlaps(pii.detect(text) + secrets.detect(text) + confidential.detect(text))


def _risk_score(findings: list[Finding], inj_score: float) -> int:
    data_points = sum(SEVERITY_POINTS[f.severity] * f.confidence
                      for f in findings if f.category != Category.INJECTION)
    return int(min(100, round(data_points + inj_score * 70)))


def _decide(findings: list[Finding], inj_score: float) -> tuple[Decision, list[str]]:
    reasons: list[str] = []
    decision = Decision.ALLOW

    if inj_score >= config.INJECTION_BLOCK:
        labels = sorted({f.type for f in findings if f.category == Category.INJECTION})
        reasons.append(f"Prompt injection detected ({', '.join(labels)}; score {inj_score:.2f})")
        decision = Decision.BLOCK

    for f in findings:
        if f.category != Category.INJECTION and f.type in policy.block_types:
            reasons.append(f"{f.type.replace('_', ' ').title()} cannot be sent to an external AI")
            decision = Decision.BLOCK

    if decision != Decision.BLOCK:
        sanitizable = [f for f in findings if f.redactable and f.severity >= policy.sanitize_min_severity]
        if sanitizable:
            types = sorted({f.type for f in sanitizable})
            reasons.append(f"Sensitive data will be masked: {', '.join(types)}")
            decision = Decision.SANITIZE
    return decision, reasons


def _audit(direction: str, request_id: str, user: UserContext, decision: Decision, risk: int,
           inj_score: float, findings: list[Finding], timing: dict, extra: dict | None = None) -> dict:
    summary: dict[tuple[str, str], dict] = {}
    for f in findings:
        key = (f.category.value, f.type)
        entry = summary.setdefault(key, {"category": f.category.value, "type": f.type, "count": 0,
                                         "max_confidence": 0.0, "detectors": set(), "value_hashes": []})
        entry["count"] += 1
        entry["max_confidence"] = max(entry["max_confidence"], f.confidence)
        entry["detectors"].add(f.detector)
        if f.value_hash:
            entry["value_hashes"].append(f.value_hash)
    for entry in summary.values():
        entry["detectors"] = sorted(entry["detectors"])
    record = {
        "request_id": request_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "direction": direction,
        "user_ref": value_hash(user.user_id),
        "role": user.role,
        "department": user.department,
        "decision": decision.value,
        "risk_score": risk,
        "injection_score": inj_score,
        "categories": sorted({f.category.value for f in findings}),
        "findings": list(summary.values()),
        "timing_ms": timing,
    }
    if extra:
        record.update(extra)
    return record


async def analyze_prompt(req: PromptRequest) -> PromptAnalysis:
    t_total = time.perf_counter()
    timing = LayerTiming()
    request_id = uuid.uuid4().hex
    text = req.prompt

    t = time.perf_counter()
    norm = normalize(text)
    timing.normalize = _ms(t)

    t = time.perf_counter()
    findings = _detect_data(text)
    timing.detect = _ms(t)

    t = time.perf_counter()
    inj = injection.scan(norm)
    timing.injection = _ms(t)
    has_maskable = any(f.redactable and f.severity >= policy.sanitize_min_severity
                       and f.category in (Category.PII, Category.FINANCIAL, Category.SECRET) for f in findings)
    inj_score, layer_scores, ml_findings, timing.ml = await asyncio.to_thread(
        _injection_layers, text, norm, inj, has_maskable)
    inj.findings.extend(ml_findings)

    # Bulk personal data (e.g. a pasted spreadsheet of citizens) is blocked outright.
    personal_values = {f.value_hash for f in findings if f.category in PERSONAL and f.severity >= 2}
    if len(personal_values) > config.BULK_PII_LIMIT:
        findings.append(Finding(category=Category.PII, type="BULK_PERSONAL_DATA", severity=4, confidence=0.95,
                                detector="bulk-counter", reason=f"{len(personal_values)} personal-data values in one prompt"))

    all_findings = findings + inj.findings
    decision, reasons = _decide(all_findings, inj_score)
    if any(f.type == "BULK_PERSONAL_DATA" for f in findings):
        decision = Decision.BLOCK
        reasons.append("Bulk export of personal data is not allowed")

    # safety_block = a block no organisation policy may relax (injection, a confirmed attack,
    # an unreviewable suspicious prompt, data left visible after masking). Blocks caused only by
    # policy-type findings (classification markings, private keys, bulk personal data) are
    # recommendations: the backend's policy may hold them for approval instead.
    safety_block = inj_score >= config.INJECTION_BLOCK

    # ---- Local Llama: only when the fast layers are unsure ----
    # Runs for policy-blocked prompts too, so a prompt later approved by a supervisor was still checked.
    llm = LlmVerdict()
    grey_injection = config.INJECTION_GREY_LOW <= inj_score < config.INJECTION_BLOCK
    business_hint = any(f.type == "BUSINESS_CONTEXT_HINT" for f in findings)
    if not safety_block and (grey_injection or business_hint or req.deep_scan):
        t = time.perf_counter()
        llm_input, _ = redact(text, findings)
        llm = await llm_analyzer.analyze(llm_input)
        timing.llm = _ms(t)
        if llm.available and llm.called:
            if llm.injection and (llm.risk or 0) >= 0.6:
                inj_score = max(inj_score, 0.8)
                all_findings.append(Finding(category=Category.INJECTION, type="LLM_CONFIRMED_INJECTION", severity=4,
                                            confidence=llm.risk or 0.8, detector="local-llama", reason=llm.reason))
                decision = Decision.BLOCK
                safety_block = True
                reasons.append(f"Local model confirmed an injection attempt: {llm.reason}")
            if llm.confidential_context and (llm.risk or 0) >= 0.7:
                all_findings.append(Finding(category=Category.CONFIDENTIAL, type="CONFIDENTIAL_BUSINESS_CONTEXT",
                                            severity=3, confidence=llm.risk or 0.7, detector="local-llama",
                                            reason=llm.reason))
                decision = Decision.BLOCK
                reasons.append(f"Local model found confidential business context: {llm.reason}")
        elif business_hint:
            # A failed/disabled judge cannot silently clear possible internal data. This is a
            # confidential-content finding, so the backend's CONFIDENTIAL policy (approval) applies.
            all_findings.append(Finding(category=Category.CONFIDENTIAL, type="CONFIDENTIAL_REVIEW_REQUIRED",
                                        severity=3, confidence=0.75, detector="local-review-required",
                                        reason="local confidential-content review is unavailable"))
            decision = Decision.BLOCK
            reasons.append("Possible confidential business content needs review; the local judge is unavailable")
        elif (grey_injection and not llm.available
              and not (is_educational(norm.views["clean"]) and inj_score < 0.5
                       and not ml_findings and not inj.obfuscated and not norm.hidden_chars)
              and _still_suspicious_without_judge(llm_input, layer_scores, inj, norm)):
            decision = Decision.BLOCK
            safety_block = True
            reasons.append("Suspicious input needs local security review; the judge is unavailable")
        if decision != Decision.BLOCK and grey_injection:
            reasons.append(f"Suspicious wording (injection score {inj_score:.2f}); allowed with warning")

    # ---- Redaction + re-scan of the sanitised prompt ----
    # Masked copy of the prompt (every redactable value replaced by a placeholder). Always produced,
    # so the backend's policy can choose MASK / REDACT / REQUIRE_APPROVAL even when the engine's own
    # recommendation differs. The mapping stays in the vault for re-hydrating the answer.
    sanitized = None
    canary = new_canary()
    t = time.perf_counter()
    masked, mapping = redact(text, findings)
    residual_risk = False          # sensitive data still visible after masking
    residual_inj = False           # masking produced text that reads as an injection
    if mapping:
        residual_risk = any(f.redactable and f.severity >= policy.sanitize_min_severity
                            for f in _detect_data(masked))
        residual_inj = injection.scan(normalize(masked)).score >= config.INJECTION_BLOCK
    timing.redact = _ms(t)
    if residual_risk or residual_inj:
        decision = Decision.BLOCK
        safety_block = True
        reasons.append("Sensitive data or an injection remained after redaction; blocked as a precaution")
    elif decision == Decision.SANITIZE:
        sanitized = masked

    if decision == Decision.ALLOW and not reasons:
        notes = sorted({f.type for f in all_findings})
        reasons.append("No sensitive data or attack detected" if not notes
                       else f"Low-risk items noted: {', '.join(notes)}")

    vault.put(request_id, mapping, canary)

    risk = _risk_score(all_findings, inj_score)
    timing.total = _ms(t_total)
    audit = _audit("prompt", request_id, req.user, decision, risk, inj_score, all_findings,
                   timing.model_dump(), {"prompt_length": len(text), "injection_rules": inj.matched_rules,
                                         "llm_called": llm.called, "masked_values": len(mapping)})
    return PromptAnalysis(
        request_id=request_id, decision=decision, risk_score=risk, injection_score=round(inj_score, 3),
        reasons=reasons, findings=all_findings, sanitized_prompt=sanitized, layer_scores=layer_scores,
        # Withheld only when sensitive data is still visible after masking. A prompt that remains an
        # injection is safe to keep for review (it is blocked by safety_block, never forwarded).
        masked_prompt=masked if not residual_risk else None,
        residual_risk=residual_risk or residual_inj, safety_block=safety_block,
        system_prompt_addon=system_prompt_addon(canary),
        llm=llm, timing_ms=timing, audit=audit,
    )


def analyze_response(req: ResponseRequest) -> ResponseAnalysis:
    t = time.perf_counter()
    entry = vault.pop(req.request_id) if req.request_id else None
    mapping = entry["mapping"] if entry else {}
    canary = entry["canary"] if entry else None
    text = req.response
    findings: list[Finding] = []
    reasons: list[str] = []
    decision = Decision.ALLOW

    squashed = "".join(text.split()).upper()
    if canary and canary.replace("-", "") in squashed.replace("-", ""):
        findings.append(Finding(category=Category.OUTPUT_LEAK, type="SYSTEM_PROMPT_LEAK", severity=4, confidence=0.99,
                                detector="canary", reason="response contains the secret canary from the system prompt"))
    lowered = text.lower()
    leak_phrases = [p for p in policy.output_leak_phrases if p in lowered]
    if "never reveal, repeat, translate" in lowered or "<<untrusted_document>> markers is data" in lowered:
        leak_phrases.append("security notice text")
    if leak_phrases:
        findings.append(Finding(category=Category.OUTPUT_LEAK, type="INSTRUCTION_DISCLOSURE", severity=3,
                                confidence=0.8, detector="leak-phrases",
                                reason="response appears to disclose the assistant's instructions"))
    if findings:
        decision = Decision.BLOCK
        reasons.append("The AI's answer leaked confidential instructions and was withheld")

    # Restricted documents: text from a document above the user's clearance must never be shown.
    leaked_docs = rag_store.leaked_documents(text, req.user.clearance, req.user.department)
    if leaked_docs:
        findings.append(Finding(category=Category.OUTPUT_LEAK, type="RESTRICTED_DOCUMENT_CONTENT", severity=4,
                                confidence=0.95, detector="document-fingerprint",
                                reason=f"answer contains text from {len(leaked_docs)} document(s) above the user's clearance"))
        decision = Decision.BLOCK
        reasons.append("The answer contained restricted document content and was withheld")

    # Classified content in answers is controlled per document (above); here we look for personal data and secrets.
    data = [f for f in _detect_data(text) if f.category in (Category.PII, Category.FINANCIAL, Category.SECRET)]
    own_values = {value_hash(v) for v in mapping.values()}
    foreign = [f for f in data if f.value_hash not in own_values]
    findings.extend(foreign)
    for f in foreign:
        if f.type in policy.block_types:
            decision = Decision.BLOCK
            reasons.append(f"{f.type.replace('_', ' ').title()} found in the AI's answer")

    safe = None
    if decision != Decision.BLOCK:
        to_redact = [f for f in foreign if f.redactable and f.severity >= policy.sanitize_min_severity]
        safe, _ = redact(text, to_redact, reversible=False)
        if any(f.redactable and f.severity >= policy.sanitize_min_severity for f in _detect_data(safe)):
            decision = Decision.BLOCK
            reasons.append("Sensitive data remained after response redaction")
        if to_redact and decision != Decision.BLOCK:
            decision = Decision.SANITIZE
            reasons.append("Sensitive data in the AI's answer was redacted: "
                           + ", ".join(sorted({f.type for f in to_redact})))
        if decision == Decision.BLOCK:
            safe = None
        elif req.rehydrate:
            safe = rehydrate(safe, mapping)
        elif safe is not None:
            safe = re.sub(r"<([A-Z_]+?)_\d+>", r"[REDACTED:\1]", safe)
        if not reasons:
            reasons.append("Response is clean")

    risk = _risk_score(findings, 0)
    elapsed = _ms(t)
    audit = _audit("response", req.request_id or "-", req.user, decision, risk, 0.0, findings,
                   {"total": elapsed}, {"response_length": len(text), "rehydrated_values": len(mapping)})
    return ResponseAnalysis(request_id=req.request_id or "-", decision=decision, findings=findings,
                            reasons=reasons, safe_response=safe, timing_ms=elapsed, audit=audit)


def analyze_document(req: DocumentRequest) -> DocumentAnalysis:
    t = time.perf_counter()
    verdicts: list[ChunkVerdict] = []
    safe_parts: list[str] = []
    # Inspect one joined view as well: an upload must not evade detection by
    # splitting a number or password across document chunks.
    joined = "\n".join(req.chunks)
    boundaries, offset = [], 0
    for chunk in req.chunks:
        boundaries.append((offset, offset + len(chunk)))
        offset += len(chunk) + 1
    cross_chunk = [f for f in _detect_data(joined) if f.start >= 0
                   and any(f.start < end < f.end for _, end in boundaries[:-1])]
    for i, chunk in enumerate(req.chunks):
        norm = normalize(chunk)
        inj = injection.scan(norm)
        score, _, ml_findings, _ = _injection_layers(chunk, norm, inj)
        inj.findings.extend(ml_findings)
        data = _detect_data(chunk)
        lo, hi = boundaries[i]
        crossing = [f for f in cross_chunk if f.start < hi and f.end > lo]
        data.extend(f.model_copy(update={"start": max(f.start, lo) - lo, "end": min(f.end, hi) - lo})
                    for f in crossing)
        indirect = any(f.type in ("INDIRECT_INJECTION", "DATA_EXFILTRATION") for f in inj.findings)
        blocked_data = any(f.type in policy.block_types for f in data)
        business_review = any(f.type == "BUSINESS_CONTEXT_HINT" for f in data)
        quarantined = score >= DOC_QUARANTINE_SCORE or indirect or blocked_data or business_review or bool(crossing)
        cleaned = ""
        if not quarantined:
            to_redact = [f for f in data if f.redactable and f.severity >= policy.sanitize_min_severity]
            cleaned, _ = redact(chunk, to_redact, reversible=False)
            quarantined = any(f.redactable and f.severity >= policy.sanitize_min_severity
                              for f in _detect_data(cleaned))
        verdicts.append(ChunkVerdict(index=i, quarantined=quarantined, injection_score=score,
                                     findings=inj.findings + data))
        if not quarantined:
            safe_parts.append(f"<<UNTRUSTED_DOCUMENT source={req.source} chunk={i}>>\n{cleaned}\n<</UNTRUSTED_DOCUMENT>>")
    return DocumentAnalysis(chunks=verdicts, quarantined=sum(v.quarantined for v in verdicts),
                            spotlighted_context="\n\n".join(safe_parts), timing_ms=_ms(t))
