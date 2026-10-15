"""Confidential-content detection: classification markings, internal codenames,
internal infrastructure, source code and business-confidential context hints."""
import re

from app.detectors.common import inside_placeholder, value_hash
from app.policy import policy
from app.schemas import Category, Finding

# Upper-case only, so "keep this secret" in normal English is not a marking.
MARKING_UPPER = re.compile(r"\b(TOP SECRET|SECRET|CONFIDENTIAL|RESTRICTED|INTERNAL ONLY|STRICTLY CONFIDENTIAL|NOT FOR CIRCULATION|CLASSIFIED)\b")
MARKING_ANYCASE = re.compile(r"\b(for official use only|fouo|not for public (?:release|circulation)|strictly private and confidential)\b|गोपनीय|अति गोपनीय|गुप्त", re.I)

PRIVATE_IP = re.compile(r"\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b")
INTERNAL_HOST = re.compile(r"\b[a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.(?:internal|corp|intranet|lan|local)\b|\bintranet\.[a-z0-9.\-]+\b", re.I)

CODE_SIGNALS = re.compile(
    r"(\bdef \w+\(|\bclass \w+[:({]|\bimport \w+|\bfrom \w+ import\b|\bpublic (?:static )?\w+ \w+\(|"
    r"#include\s*<|\bfunction \w+\(|=>\s*\{|\bconst \w+\s*=|\bSELECT .+ FROM\b|\bpackage \w+;|"
    r"@(?:RestController|Service|Autowired|Override)\b|\bconsole\.log\(|System\.out\.println\()",
    re.I,
)

# Hints that a prompt may contain unreleased business information. These are only
# hints: the local LLM decides whether it is really confidential.
BUSINESS_HINTS = re.compile(
    r"\b(unreleased|not yet (?:public|announced|released)|under nda|non-disclosure|internal (?:memo|audit|report|financials?|figures)|"
    r"board (?:meeting|minutes)|quarterly (?:results|numbers) before|merger|acquisition talks|tender (?:bid|amount)|bid amount|"
    r"salary (?:of|details|slip)|appraisal ratings?|layoffs?|draft (?:policy|budget) not|cabinet note|file noting|"
    r"internal pricing|price list for|customer list|vendor rates|source code of our|our proprietary)\b",
    re.I,
)


def detect(text: str) -> list[Finding]:
    findings: list[Finding] = []

    for regex in (MARKING_UPPER, MARKING_ANYCASE):
        for m in regex.finditer(text):
            line_start = text.rfind("\n", 0, m.start()) + 1
            header_like = m.start() - line_start < 5 or text[max(0, m.start() - 1):m.start()] in "[(*#:"
            findings.append(Finding(
                category=Category.CONFIDENTIAL, type="CLASSIFICATION_MARKING", severity=3,
                confidence=0.92 if header_like else 0.75, start=m.start(), end=m.end(),
                detector="marking", redactable=False, preview=m.group(0), value_hash=value_hash(m.group(0)),
                reason="document carries a classification marking",
            ))

    for name in policy.codenames:
        for m in re.finditer(rf"\b{re.escape(name)}\b", text, re.I):
            findings.append(Finding(
                category=Category.CONFIDENTIAL, type="INTERNAL_CODENAME", severity=3, confidence=0.9,
                start=m.start(), end=m.end(), detector="codename-dictionary", redactable=True,
                preview=name[0] + "***", value_hash=value_hash(m.group(0)),
            ))

    for type_, regex in (("INTERNAL_IP", PRIVATE_IP), ("INTERNAL_HOST", INTERNAL_HOST)):
        for m in regex.finditer(text):
            if inside_placeholder(text, m.start(), m.end()):
                continue
            findings.append(Finding(
                category=Category.CONFIDENTIAL, type=type_, severity=2, confidence=0.85,
                start=m.start(), end=m.end(), detector="infrastructure", redactable=True,
                preview=re.sub(r"[A-Za-z0-9]", "x", m.group(0))[:20], value_hash=value_hash(m.group(0)),
            ))

    if len(CODE_SIGNALS.findall(text)) >= 2:
        findings.append(Finding(
            category=Category.CONFIDENTIAL, type="SOURCE_CODE", severity=1, confidence=0.7,
            detector="code-heuristic", reason="prompt contains source code; check that it is not proprietary",
        ))

    hints = {m.group(0).lower() for m in BUSINESS_HINTS.finditer(text)}
    if hints:
        findings.append(Finding(
            category=Category.CONFIDENTIAL, type="BUSINESS_CONTEXT_HINT", severity=1, confidence=0.5,
            detector="keyword-hint", reason="possible confidential business context: " + ", ".join(sorted(hints)[:3]),
        ))
    return findings
