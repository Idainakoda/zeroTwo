"""Personal and financial data detection: India-first regex + checksum validators,
plus Microsoft Presidio NER for person names."""
import logging
import re
from typing import Callable, Optional

from app import config
from app.detectors.canonical import DIGIT_WORDS, WORD_ALTERNATIVES, canonicalize, number_candidates
from app.detectors import validators as v
from app.detectors.common import has_context, inside_placeholder, preview, value_hash
from app.schemas import Category, Finding

log = logging.getLogger(__name__)

CTX_AADHAAR = re.compile(r"\b(?:aadh?aa?r|uid|uidai)\b|आधार", re.I)
# Wording that calls a 12-digit value an identity number without saying "Aadhaar" ("IDREF", "KYC",
# "ID#", "identity number"). Order, invoice, batch and similar IDs are not identity numbers.
CTX_IDENTITY = re.compile(
    r"\b(?:kyc|id\s*ref|idref|identity\s+(?:number|identifier|no|card|record)|identification\s+number|"
    r"national\s+id|citizen\s+id|indian\s+id)\b|"
    r"(?<!order )(?<!ticket )(?<!invoice )(?<!batch )(?<!tender )(?<!transaction )(?<!employee )(?<!session )"
    r"(?<!product )(?<!request )\bid\s*(?:#|no\.?|number|:)", re.I)
CTX_VID = re.compile(r"\bvid\b|virtual\s*id", re.I)
CTX_ACCOUNT = re.compile(r"a/?c\b|acc(oun)?t|acct|bank|khata|खाता|savings|current\s+account", re.I)
CTX_PASSPORT = re.compile(r"passport|पासपोर्ट", re.I)
CTX_VOTER = re.compile(r"voter|epic|election|मतदाता", re.I)
CTX_DL = re.compile(r"licen[cs]e|\bdl\b|driving", re.I)
CTX_DOB = re.compile(r"\bdob\b|date\s+of\s+birth|born\s+on|जन्म", re.I)
CTX_PAN = re.compile(r"\bpan\b|income\s*tax|पैन", re.I)
CTX_PHONE = re.compile(r"\b(?:phone|mobile|contact|telephone|tel|whatsapp|call)\b|मोबाइल|फ़ोन|फोन", re.I)
CTX_CARD = re.compile(r"\b(?:(?:credit|debit|payment)\s*card|card\s*(?:number|no)|cvv|cvc)\b", re.I)
FINANCIAL_FIELDS = re.compile(
    r"(?i)\b(?P<label>cvv|cvc|card\s*pin|account\s*balance|bank\s*balance|salary|net\s*pay)"
    r"\s*(?:is\b|[:=])\s*(?P<value>(?:(?:INR|Rs\.?|USD|EUR|GBP)\s*|[₹$€£]\s*)?"
    r"[0-9][0-9,]*(?:\.[0-9]{1,2})?(?:\s*(?:crore|lakh|million|billion))?)(?![\w])"
)
IBAN = re.compile(r"(?<!\w)[A-Z]{2}[0-9]{2}", re.I)
IBAN_LENGTHS = {"GB": 22, "DE": 22, "FR": 27, "NL": 18, "ES": 24, "IT": 27,
                "IE": 22, "CH": 21, "BE": 16, "AT": 20, "AE": 23, "SA": 24}

IDENTIFIER_GAP = r"[\s.\-‐‑‒–—―/|_]{0,4}"
DIGIT = rf"(?:[0-9]|(?<!\w)(?:{WORD_ALTERNATIVES})(?!\w))"
PAN_FLEXIBLE = re.compile(
    rf"(?<!\w)[A-Z]{IDENTIFIER_GAP}[A-Z]{IDENTIFIER_GAP}[A-Z]{IDENTIFIER_GAP}"
    rf"[A-Z]{IDENTIFIER_GAP}[A-Z]{IDENTIFIER_GAP}"
    rf"{DIGIT}{IDENTIFIER_GAP}{DIGIT}{IDENTIFIER_GAP}{DIGIT}{IDENTIFIER_GAP}{DIGIT}{IDENTIFIER_GAP}[A-Z](?!\w)", re.I
)
IDENTIFIER_SEPARATORS = re.compile(r"[\s.\-‐‑‒–—―/|_]+")
DIGIT_WORD_PATTERN = re.compile(rf"(?<!\w)(?:{WORD_ALTERNATIVES})(?!\w)", re.I)


def _numeric_findings(text: str, view) -> list[Finding]:
    out = []

    def add(type_, category, start, end, confidence, reason=""):
        start, end = view.original_span(start, end)
        if inside_placeholder(text, start, end):
            return
        value = text[start:end]
        out.append(Finding(category=category, type=type_, severity=4 if type_ != "PHONE_IN" else 3,
                           confidence=confidence, start=start, end=end, detector="canonical+validator+context",
                           redactable=True, preview=preview(value), value_hash=value_hash(value), reason=reason))

    for candidate in number_candidates(view.text):
        d, start, end = candidate.digits, candidate.start, candidate.end
        aadhaar = (has_context(view.text, start, end, CTX_AADHAAR, window=80)
                   or has_context(view.text, start, end, CTX_IDENTITY))
        # A 12-digit value deliberately chopped into pieces of one or two digits ("7|6|1|1 :: 9|1|2|6")
        # is a disguised identifier, whatever its checksum.
        aadhaar = aadhaar or (len(d) == 12 and (candidate.parts >= 6 or candidate.spoken))
        card = has_context(view.text, start, end, CTX_CARD)
        account = has_context(view.text, start, end, CTX_ACCOUNT)
        phone_context = has_context(view.text, start, end, CTX_PHONE)
        if len(d) == 12:
            if v.aadhaar_valid(d):
                add("AADHAAR", Category.PII, start, end, 0.99 if aadhaar else 0.93)
            elif aadhaar:
                add("POSSIBLE_AADHAAR", Category.PII, start, end, 0.75,
                    "Aadhaar-labelled 12-digit value has an invalid checksum; masked conservatively")
        if len(d) == 16 and has_context(view.text, start, end, CTX_VID):
            if v.vid_valid(d):
                add("AADHAAR_VID", Category.PII, start, end, 0.96)
        if 13 <= len(d) <= 19:
            if v.luhn_valid(d):
                add("CREDIT_CARD", Category.FINANCIAL, start, end, 0.96)
            elif card:
                add("POSSIBLE_CREDIT_CARD", Category.FINANCIAL, start, end, 0.75,
                    "Card-labelled value has an invalid checksum; masked conservatively")
        if 9 <= len(d) <= 18 and account:
            add("BANK_ACCOUNT", Category.FINANCIAL, start, end, 0.9)
        local = d[4:] if d.startswith("0091") else d[2:] if d.startswith("91") and len(d) == 12 else d
        if len(local) == 11 and local.startswith("0"):
            local = local[1:]
        if (len(local) == 10 and local[0] in "6789" and len(set(local)) > 1
                and (not candidate.spoken or phone_context)):
            add("PHONE_IN", Category.PII, start, end, 0.94 if phone_context else 0.85)

    for match in PAN_FLEXIBLE.finditer(view.text):
        value = DIGIT_WORD_PATTERN.sub(lambda m: DIGIT_WORDS[m.group().lower()], match.group())
        value = IDENTIFIER_SEPARATORS.sub("", value).upper()
        if v.pan_valid(value):
            add("PAN", Category.PII, match.start(), match.end(), 0.96)
        elif has_context(view.text, match.start(), match.end(), CTX_PAN):
            add("POSSIBLE_PAN", Category.PII, match.start(), match.end(), 0.75,
                "PAN-labelled identifier has an invalid holder type; masked conservatively")
    for match in FINANCIAL_FIELDS.finditer(view.text):
        add("CARD_SECURITY_CODE" if re.search(r"cvv|cvc|pin", match.group("label"), re.I) else "FINANCIAL_AMOUNT",
            Category.FINANCIAL, *match.span("value"), 0.9)
    for match in IBAN.finditer(view.text):
        length = IBAN_LENGTHS.get(match.group()[:2].upper())
        if length is None:
            continue
        cursor, value = match.start(), ""
        while cursor < len(view.text) and len(value) < length and cursor - match.start() < 2 * length:
            ch = view.text[cursor].upper()
            if ch.isascii() and ch.isalnum():
                value += ch
            elif not ch.isspace():
                break
            cursor += 1
        if (len(value) == length and (cursor == len(view.text) or not view.text[cursor].isalnum())
                and v.iban_valid(value)):
            add("IBAN", Category.FINANCIAL, match.start(), cursor, 0.97)
    return out

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
        self.regex = re.compile(pattern, flags | (re.I if type_ in {"GSTIN", "IFSC", "PASSPORT_IN", "VOTER_ID", "DRIVING_LICENSE"} else 0))
        self.severity = severity
        self.confidence = confidence
        self.validate = validate
        self.context = context
        self.context_required = context_required
        self.group = group
        self.keep = keep


RULES = [
    Rule("GSTIN", Category.FINANCIAL, r"\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b", 3, 0.95,
         validate=v.gstin_valid),
    Rule("EMAIL", Category.PII, r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b", 2, 0.95),
    Rule("UPI_ID", Category.FINANCIAL, rf"\b[A-Za-z0-9.\-_]{{2,64}}@(?:{UPI_HANDLES})\b", 3, 0.9, flags=re.I),
    Rule("IFSC", Category.FINANCIAL, r"\b[A-Z]{4}0[A-Z0-9]{6}\b", 1, 0.8),
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
    # programming words spaCy mistakes for names in code snippets
    "string", "integer", "int", "long", "boolean", "bool", "double", "float", "char", "object", "list",
    "map", "set", "dict", "tuple", "array", "arraylist", "hashmap", "optional", "void", "null", "none",
    "true", "false", "override", "autowired", "system", "exception", "public", "private", "static",
    "final", "class", "return", "import", "select", "insert", "update", "values", "where", "from",
    "json", "yaml", "http", "https", "api", "url", "uri", "sql", "mysql", "spring", "react", "node",
}
NAME_TRIM = "\"'`.,;:()[]{}<>!?*_-"


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
        # Trim quotes / punctuation NER sometimes includes, so masking never breaks code like 'Sunita Sharma'.
        raw = text[r.start:r.end]
        start = r.start + (len(raw) - len(raw.lstrip(NAME_TRIM + " \n\t")))
        end = r.end - (len(raw) - len(raw.rstrip(NAME_TRIM + " \n\t")))
        value = text[start:end]
        words = value.split()
        if (len(value) < 3 or any(ch.isdigit() for ch in value) or value.isupper()
                or value.lower() in NAME_STOPWORDS or any(w.lower() in NAME_STOPWORDS for w in words)
                or any(ch in value for ch in "=;{}()<>/\\") or not value[0].isupper()
                or inside_placeholder(text, start, end)):
            continue
        out.append(Finding(
            category=Category.PII, type="PERSON", severity=1, confidence=round(r.score, 2),
            start=start, end=end, detector="presidio-ner", redactable=True,
            preview=value[0] + "*" * (len(value) - 1), value_hash=value_hash(value),
        ))
    return out


def detect(text: str) -> list[Finding]:
    view = canonicalize(text)
    findings: list[Finding] = _numeric_findings(text, view)
    for rule in RULES:
        for m in rule.regex.finditer(view.text):
            start, end = view.original_span(*m.span(rule.group))
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
                redactable=True, preview=preview(text[start:end], rule.keep), value_hash=value_hash(text[start:end]),
            ))
    findings.extend(_person_findings(text))
    return findings
