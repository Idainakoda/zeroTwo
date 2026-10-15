"""Personal and financial data detection: India-first regex + checksum validators,
plus Microsoft Presidio NER for person names."""
import logging
import re
from typing import Callable, Optional

from app import config
from app.detectors import validators as v
from app.detectors.common import has_context, inside_placeholder, preview, value_hash
from app.schemas import Category, Finding

log = logging.getLogger(__name__)

CTX_AADHAAR = re.compile(r"aadh?aa?r|uid|आधार|uidai", re.I)
CTX_VID = re.compile(r"\bvid\b|virtual\s*id", re.I)
CTX_ACCOUNT = re.compile(r"a/?c\b|acc(oun)?t|acct|bank|khata|खाता|savings|current\s+account", re.I)
CTX_PASSPORT = re.compile(r"passport|पासपोर्ट", re.I)
CTX_VOTER = re.compile(r"voter|epic|election|मतदाता", re.I)
CTX_DL = re.compile(r"licen[cs]e|\bdl\b|driving", re.I)
CTX_DOB = re.compile(r"\bdob\b|date\s+of\s+birth|born\s+on|जन्म", re.I)
CTX_PAN = re.compile(r"\bpan\b|income\s*tax|पैन", re.I)

UPI_HANDLES = (
    "upi|ybl|ibl|axl|apl|okaxis|oksbi|okhdfcbank|okicici|paytm|ptyes|ptsbi|pthdfc|ptaxis|"
    "icici|hdfcbank|sbi|axisbank|kotak|yesbank|fbl|jupiteraxis|freecharge|airtel|postbank"
)


class Rule:
    def __init__(self, type_: str, category: Category, pattern: str, severity: int,
                 confidence: float, flags: int = 0,
                 validate: Optional[Callable[[str], bool]] = None,
                 context: Optional[re.Pattern] = None, context_required: bool = False,
                 group: int = 0, keep: int = 4):
        self.type = type_
        self.category = category
        self.regex = re.compile(pattern, flags)
        self.severity = severity
        self.confidence = confidence
        self.validate = validate
        self.context = context
        self.context_required = context_required
        self.group = group
        self.keep = keep


RULES = [
    Rule("AADHAAR", Category.PII, r"(?<![\d\w])[2-9]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}(?![\d\w])", 4, 0.93,
         validate=v.aadhaar_valid, context=CTX_AADHAAR),
    Rule("AADHAAR_VID", Category.PII, r"(?<!\d)\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}(?!\d)", 4, 0.9,
         validate=v.vid_valid, context=CTX_VID, context_required=True),
    Rule("CREDIT_CARD", Category.FINANCIAL, r"(?<!\d)(?:\d[\s\-]?){12,18}\d(?!\d)", 4, 0.9,
         validate=v.luhn_valid),
    Rule("PAN", Category.PII, r"\b[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]\b", 4, 0.9,
         validate=v.pan_valid, context=CTX_PAN),
    Rule("GSTIN", Category.FINANCIAL, r"\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b", 3, 0.95,
         validate=v.gstin_valid),
    Rule("PHONE_IN", Category.PII, r"(?<![\d+])(?:(?:\+|00)?91[\s\-]?|0)?[6-9]\d{4}[\s\-]?\d{5}(?!\d)", 3, 0.85),
    Rule("EMAIL", Category.PII, r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b", 2, 0.95),
    Rule("UPI_ID", Category.FINANCIAL, rf"\b[A-Za-z0-9.\-_]{{2,64}}@(?:{UPI_HANDLES})\b", 3, 0.9, flags=re.I),
    Rule("IFSC", Category.FINANCIAL, r"\b[A-Z]{4}0[A-Z0-9]{6}\b", 1, 0.8),
    Rule("BANK_ACCOUNT", Category.FINANCIAL, r"(?<![\d\w])\d{9,18}(?![\d\w])", 4, 0.8,
         context=CTX_ACCOUNT, context_required=True),
    Rule("PASSPORT_IN", Category.PII, r"\b[A-PR-WY][1-9]\d\s?\d{4}[1-9]\b", 3, 0.85,
         context=CTX_PASSPORT, context_required=True),
    Rule("VOTER_ID", Category.PII, r"\b[A-Z]{3}\d{7}\b", 3, 0.85,
         context=CTX_VOTER, context_required=True),
    Rule("DRIVING_LICENSE", Category.PII, r"\b[A-Z]{2}[\-\s]?\d{2}[\-\s]?(?:19|20)\d{2}[\-\s]?\d{7}\b", 3, 0.85,
         context=CTX_DL, context_required=True),
    Rule("DATE_OF_BIRTH", Category.PII, r"\b(?:\d{1,2}[/\-.]\d{1,2}[/\-.](?:19|20)\d{2}|(?:19|20)\d{2}-\d{2}-\d{2})\b", 2, 0.8,
         context=CTX_DOB, context_required=True),
]

# Words spaCy's small model sometimes tags as PERSON.
NAME_STOPWORDS = {
    "aadhaar", "aadhar", "pan", "ifsc", "upi", "gst", "gstin", "emi", "sbi", "hdfc", "icici",
    "india", "bharat", "dear", "sir", "madam", "regards", "hello", "hi", "thanks", "kindly",
    "please", "draft", "write", "summarise", "summarize", "python", "java", "javascript",
    "mobile", "a/c", "dob", "vid", "kyc", "rti", "ai", "llm",
}


class _Presidio:
    """Lazy wrapper so the engine still runs if Presidio / spaCy are not installed."""

    def __init__(self):
        self.engine = None
        self.error = ""

    def load(self) -> None:
        if not config.USE_PRESIDIO or self.engine is not None:
            return
        try:
            from presidio_analyzer import AnalyzerEngine
            from presidio_analyzer.nlp_engine import NlpEngineProvider

            provider = NlpEngineProvider(nlp_configuration={
                "nlp_engine_name": "spacy",
                "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
            })
            self.engine = AnalyzerEngine(nlp_engine=provider.create_engine(), supported_languages=["en"])
            log.info("Presidio loaded")
        except Exception as exc:  # pragma: no cover - depends on environment
            self.error = str(exc)
            log.warning("Presidio unavailable, using regex only: %s", exc)

    @property
    def ready(self) -> bool:
        return self.engine is not None


presidio = _Presidio()


def _person_findings(text: str) -> list[Finding]:
    if not presidio.ready:
        return []
    out = []
    for r in presidio.engine.analyze(text=text, entities=["PERSON"], language="en", score_threshold=0.6):
        value = text[r.start:r.end].strip()
        words = value.split()
        if (len(value) < 3 or any(ch.isdigit() for ch in value) or value.isupper()
                or value.lower() in NAME_STOPWORDS or any(w.lower() in NAME_STOPWORDS for w in words)
                or not value[0].isupper() or inside_placeholder(text, r.start, r.end)):
            continue
        out.append(Finding(
            category=Category.PII, type="PERSON", severity=1, confidence=round(r.score, 2),
            start=r.start, end=r.end, detector="presidio-ner", redactable=True,
            preview=value[0] + "*" * (len(value) - 1), value_hash=value_hash(value),
        ))
    return out


def detect(text: str) -> list[Finding]:
    findings: list[Finding] = []
    for rule in RULES:
        for m in rule.regex.finditer(text):
            start, end = m.span(rule.group)
            value = m.group(rule.group)
            if inside_placeholder(text, start, end):
                continue
            if rule.validate and not rule.validate(value):
                continue
            ctx = has_context(text, start, end, rule.context) if rule.context else False
            if rule.context_required and not ctx:
                continue
            confidence = min(0.99, rule.confidence + (0.06 if ctx else 0))
            findings.append(Finding(
                category=rule.category, type=rule.type, severity=rule.severity,
                confidence=round(confidence, 2), start=start, end=end,
                detector="regex+validator" if rule.validate else ("regex+context" if rule.context else "regex"),
                redactable=True, preview=preview(value, rule.keep), value_hash=value_hash(value),
            ))
    findings.extend(_person_findings(text))
    return findings
