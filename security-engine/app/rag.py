"""Access-controlled retrieval (RAG).

Documents carry a classification (PUBLIC < INTERNAL < CONFIDENTIAL < SECRET) and an optional
department list. Access is enforced BEFORE retrieval: chunks the user may not see are never
scored against the query and never reach the AI. Separately, the query is compared with the
restricted chunks (metadata only) so an attempt to reach a restricted document is logged as
an incident, without telling the user what the document is.

Retrieved chunks are also scanned for indirect prompt injection and personal data/secrets
before they are added to the AI's context.
"""
import logging
import re
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from app.detectors import injection, pii, secrets
from app.detectors.ml_injection import ml
from app.normalizer import normalize
from app.redaction import redact, resolve_overlaps
from app.schemas import Category, Finding

log = logging.getLogger(__name__)

DOCS_DIR = Path(__file__).resolve().parent.parent / "rag_docs"
LEVELS = {"PUBLIC": 0, "INTERNAL": 1, "CONFIDENTIAL": 2, "SECRET": 3}
MIN_RELEVANCE = 0.30          # cosine similarity below this is not relevant
ATTEMPT_MARGIN = 0.05         # restricted match must beat the best allowed match by this much
SHINGLE = 8                   # words per shingle for the response fingerprint check


@dataclass
class Chunk:
    doc_id: str
    title: str
    classification: str
    departments: list[str]
    text: str
    index: int


@dataclass
class Doc:
    id: str
    title: str
    classification: str
    departments: list[str]
    chunks: list[Chunk] = field(default_factory=list)
    shingles: set[str] = field(default_factory=set)


def level(name: str) -> int:
    """Level of a document's classification. Unknown or misspelt labels count as SECRET, never PUBLIC."""
    return LEVELS.get((name or "").strip().upper(), LEVELS["SECRET"])


def clearance_level(name: str) -> int:
    """Level of a user's clearance. Unknown or missing clearances get the least access (PUBLIC)."""
    return LEVELS.get((name or "").strip().upper(), LEVELS["PUBLIC"])


def _parse(path: Path) -> Doc | None:
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", raw, re.S)
    if not m:
        return None
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip().lower()] = v.strip()
    body = m.group(2).strip()
    doc = Doc(id=meta.get("id", path.stem), title=meta.get("title", path.stem),
              classification=meta.get("classification", "INTERNAL").upper(),
              departments=[d.strip() for d in meta.get("departments", "").split(",") if d.strip()])
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    doc.chunks = [Chunk(doc.id, doc.title, doc.classification, doc.departments, p, i)
                  for i, p in enumerate(paragraphs)]
    doc.shingles = _shingles(body)
    return doc


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _shingles(text: str) -> set[str]:
    w = _words(text)
    return {" ".join(w[i:i + SHINGLE]) for i in range(max(0, len(w) - SHINGLE + 1))}


class DocumentStore:
    def __init__(self):
        self.docs: dict[str, Doc] = {}
        self.chunks: list[Chunk] = []
        self.vectors = None
        self._lock = threading.Lock()

    def load(self) -> None:
        with self._lock:
            docs = [d for d in (_parse(p) for p in sorted(DOCS_DIR.glob("*.md"))) if d]
            self.docs = {d.id: d for d in docs}
            self.chunks = [c for d in docs for c in d.chunks]
            self.vectors = None
            if ml.embedder is not None and self.chunks:
                self.vectors = ml.embedder.encode([f"{c.title}. {c.text}" for c in self.chunks],
                                                  normalize_embeddings=True, show_progress_bar=False, convert_to_tensor=True)
            log.info("RAG store: %d documents, %d chunks (semantic=%s)", len(docs), len(self.chunks), ml.embedder is not None)

    @staticmethod
    def can_access(chunk_or_doc, clearance: str, department: str) -> bool:
        if level(chunk_or_doc.classification) > clearance_level(clearance):
            return False
        # Department-scoped documents: only listed departments, unless the user holds SECRET clearance.
        if chunk_or_doc.departments and clearance_level(clearance) < LEVELS["SECRET"]:
            return (department or "").strip().lower() in {d.lower() for d in chunk_or_doc.departments}
        return True

    def list_documents(self, clearance: str | None = None, department: str = "") -> list[dict]:
        out = []
        for d in self.docs.values():
            item = {"id": d.id, "title": d.title, "classification": d.classification,
                    "departments": d.departments, "chunks": len(d.chunks)}
            if clearance is not None:
                item["accessible"] = self.can_access(d, clearance, department)
            out.append(item)
        return sorted(out, key=lambda x: (level(x["classification"]), x["id"]))

    def _scores(self, query: str) -> list[float]:
        if self.vectors is not None:
            from sentence_transformers import util
            q = ml.embedder.encode([query], normalize_embeddings=True, show_progress_bar=False, convert_to_tensor=True)
            return [float(s) for s in util.cos_sim(q, self.vectors)[0]]
        # Fallback without the embedding model: keyword overlap.
        qw = set(_words(query))
        return [len(qw & set(_words(c.text + " " + c.title))) / (len(qw) or 1) for c in self.chunks]

    def search(self, query: str, clearance: str, department: str, top_k: int = 4) -> dict:
        t = time.perf_counter()
        scores = self._scores(query)
        allowed, restricted = [], []
        for chunk, score in zip(self.chunks, scores):
            (allowed if self.can_access(chunk, clearance, department) else restricted).append((score, chunk))
        allowed.sort(key=lambda x: -x[0])
        restricted.sort(key=lambda x: -x[0])

        best_allowed = allowed[0][0] if allowed else 0.0
        best_restricted = restricted[0][0] if restricted else 0.0
        attempt = best_restricted >= MIN_RELEVANCE and best_restricted > best_allowed + ATTEMPT_MARGIN
        restricted_hits = [c for s, c in restricted if s >= MIN_RELEVANCE and s > best_allowed]

        results, quarantined = [], 0
        for score, chunk in allowed[:top_k]:
            if score < MIN_RELEVANCE:
                break
            clean, findings, blocked = scan_chunk(chunk.text)
            if blocked:
                quarantined += 1
                continue
            results.append({"doc_id": chunk.doc_id, "title": chunk.title, "classification": chunk.classification,
                            "score": round(score, 3), "text": clean,
                            "redacted": sorted({f.type for f in findings if f.redactable})})

        context = "\n\n".join(
            f"<<UNTRUSTED_DOCUMENT id={r['doc_id']} title=\"{r['title']}\" classification={r['classification']}>>\n"
            f"{r['text']}\n<</UNTRUSTED_DOCUMENT>>" for r in results)
        max_cls = max((r["classification"] for r in results), key=level, default=None)
        return {
            "results": results,
            "context": context,
            "max_classification": max_cls,
            "quarantined": quarantined,
            "unauthorised_attempt": attempt,
            # For the audit log only: never shown to the requesting user.
            "restricted_matches": len({c.doc_id for c in restricted_hits}),
            "restricted_classification": max((c.classification for c in restricted_hits), key=level, default=None),
            "restricted_doc_ids": sorted({c.doc_id for c in restricted_hits}),
            "timing_ms": round((time.perf_counter() - t) * 1000, 2),
        }

    def leaked_documents(self, response: str, clearance: str, department: str) -> list[str]:
        """Doc ids the user may NOT see whose text appears in the response (8-word overlaps)."""
        resp = _shingles(response)
        if not resp:
            return []
        leaked = []
        for d in self.docs.values():
            if not self.can_access(d, clearance, department) and len(resp & d.shingles) >= 2:
                leaked.append(d.id)
        return leaked


def scan_chunk(text: str) -> tuple[str, list[Finding], bool]:
    """Indirect-injection check + redaction of personal data / secrets inside a retrieved chunk.

    Classified content is NOT redacted here: access control already decided the user may see it.
    """
    inj = injection.scan(normalize(text))
    score = inj.score
    if ml.ready:
        res = ml.analyze([text])
        score = max(score, res.semantic * 0.8, res.classifier * 0.7)
    indirect = any(f.type in ("INDIRECT_INJECTION", "DATA_EXFILTRATION") for f in inj.findings)
    if score >= 0.45 or indirect:
        return "", inj.findings, True
    data = resolve_overlaps(pii.detect(text) + secrets.detect(text))
    if any(not f.redactable and f.category == Category.SECRET for f in data):
        return "", data, True
    to_redact = [f for f in data if f.redactable and f.severity >= 2
                 and f.category in (Category.PII, Category.FINANCIAL, Category.SECRET)]
    clean, _ = redact(text, to_redact, reversible=False)
    residual = pii.detect(clean) + secrets.detect(clean)
    if any(f.severity >= 2 for f in residual):
        return "", data, True
    return clean, to_redact, False


store = DocumentStore()
