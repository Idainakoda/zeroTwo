"""Recognises standard Indian identity and financial documents in uploaded files.

Works on typed text and on OCR output, which often loses spaces ("GovernmentofIndia"), so
cues are matched on a squashed, lower-case view. A document is recognised only when its
printed titles and field labels add up: a letter that merely mentions "PAN" is not a PAN card.

Each document type scores:
  anchor (printed title, e.g. "Income Tax Department")   2 points each
  field  (label printed on the document, e.g. "DOB")      1 point each
  identifier of that type found by the PII detectors       2 points
and is recognised at MIN_SCORE or more, with at least one anchor or identifier.
"""
import re
from dataclasses import dataclass, field

MIN_SCORE = 5


@dataclass(frozen=True)
class DocSpec:
    type: str
    label: str
    group: str                      # IDENTITY or FINANCIAL (policy decides what each means)
    anchors: tuple[str, ...]
    fields: tuple[str, ...] = ()
    identifiers: tuple[str, ...] = ()


SPECS: tuple[DocSpec, ...] = (
    DocSpec("AADHAAR_CARD", "Aadhaar card", "IDENTITY",
            anchors=("aadhaar", "aadhar", "uidai", "uniqueidentificationauthority", "आधार", "मेराआधार",
                     "enrolmentno", "enrollmentno"),
            fields=("governmentofindia", "भारतसरकार", "dob", "dateofbirth", "yearofbirth", "male", "female",
                    "address", "vid", "issuedate", "s/o", "d/o", "w/o", "c/o"),
            identifiers=("AADHAAR", "AADHAAR_VID", "POSSIBLE_AADHAAR")),
    DocSpec("PAN_CARD", "PAN card", "IDENTITY",
            anchors=("incometaxdepartment", "permanentaccountnumber", "आयकरविभाग", "स्थायीलेखासंख्या"),
            fields=("governmentofindia", "govtofindia", "भारतसरकार", "fathersname", "father'sname",
                    "dateofbirth", "signature", "name"),
            identifiers=("PAN", "POSSIBLE_PAN")),
    DocSpec("PASSPORT", "Passport", "IDENTITY",
            anchors=("republicofindia", "passport", "p<ind", "भारतगणराज्य", "पासपोर्ट"),
            fields=("nationality", "indian", "placeofbirth", "placeofissue", "dateofissue", "dateofexpiry",
                    "surname", "givenname", "fileno", "nameoffather", "nameofmother"),
            identifiers=("PASSPORT_IN",)),
    DocSpec("VOTER_ID", "Voter ID card", "IDENTITY",
            anchors=("electioncommissionofindia", "electorsphotoidentitycard", "electorphotoidentitycard",
                     "epic", "भारतनिर्वाचनआयोग"),
            fields=("elector", "electorsname", "fathersname", "husbandsname", "sex", "age", "dateofbirth",
                    "assemblyconstituency", "partno"),
            identifiers=("VOTER_ID",)),
    DocSpec("DRIVING_LICENCE", "Driving licence", "IDENTITY",
            anchors=("drivinglicence", "drivinglicense", "transportdepartment", "uniondrivinglicence"),
            fields=("dlno", "validtill", "validity", "dateofissue", "cov", "classofvehicle", "bloodgroup",
                    "s/d/wof", "dateofbirth", "authorisationtodrive", "authorizationtodrive"),
            identifiers=("DRIVING_LICENSE",)),
    DocSpec("BANK_STATEMENT", "Bank statement", "FINANCIAL",
            anchors=("statementofaccount", "accountstatement", "bankstatement", "passbook"),
            fields=("openingbalance", "closingbalance", "ifsc", "micr", "accountno", "a/cno", "withdrawal",
                    "deposit", "transactiondate", "valuedate", "branch", "customerid", "balance"),
            identifiers=("BANK_ACCOUNT", "IFSC")),
    DocSpec("CHEQUE", "Bank cheque", "FINANCIAL",
            anchors=("orbearer", "a/cpayee", "accountpayee", "payagainst"),
            fields=("pay", "rupees", "ifsc", "micr", "validforthreemonths", "authorisedsignatory",
                    "authorizedsignatory", "a/cno", "branch"),
            identifiers=("BANK_ACCOUNT", "IFSC")),
    DocSpec("SALARY_SLIP", "Salary slip", "FINANCIAL",
            anchors=("payslip", "salaryslip", "paystatement", "payadvice"),
            fields=("basicpay", "basic", "hra", "grossearnings", "grosssalary", "netpay", "netsalary",
                    "deductions", "providentfund", "uan", "professionaltax", "tds", "employeeid", "paydays"),
            identifiers=("PAN", "BANK_ACCOUNT")),
    DocSpec("FORM_16", "Form 16 (tax certificate)", "FINANCIAL",
            anchors=("form16", "form no.16", "formno16", "certificateundersection203"),
            fields=("tan", "pan", "assessmentyear", "taxdeductedatsource", "employer", "employee",
                    "grosssalary", "chaptervi-a"),
            identifiers=("PAN",)),
)


@dataclass
class DocumentMatch:
    type: str
    label: str
    group: str
    confidence: float
    score: int
    evidence: list[str] = field(default_factory=list)     # cue names only, never values

    def as_dict(self) -> dict:
        return {"type": self.type, "label": self.label, "group": self.group,
                "confidence": self.confidence, "score": self.score, "evidence": self.evidence}


def squash(text: str) -> str:
    """Lower-case and drop spaces/punctuation that OCR gets wrong; keep '/', '<' and "'" used in cues."""
    return re.sub(r"[^\w/<']+", "", text.lower())


def _squash_cue(cue: str) -> str:
    return re.sub(r"[^\w/<']+", "", cue.lower())


def _has(view: str, cue: str) -> bool:
    c = _squash_cue(cue)
    # Short cues ("dob", "vid", "pay") must stand alone in the original wording to count.
    if len(c) <= 4 and c.isalnum():
        return False
    return c in view


def _has_short(text_lower: str, cue: str) -> bool:
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(cue)}(?![a-z0-9])", text_lower))


def recognise(text: str, identifier_types: set[str]) -> list[DocumentMatch]:
    """Document types the text looks like, strongest first."""
    if not text or not text.strip():
        return []
    view = squash(text)
    lower = text.lower()
    matches: list[DocumentMatch] = []
    for spec in SPECS:
        evidence: list[str] = []
        score = 0
        anchors = 0
        for cue in spec.anchors:
            if _has(view, cue) or (len(_squash_cue(cue)) <= 4 and _has_short(lower, cue)):
                evidence.append(cue)
                score += 2
                anchors += 1
        for cue in spec.fields:
            if _has(view, cue) or (len(_squash_cue(cue)) <= 4 and _has_short(lower, cue)):
                evidence.append(cue)
                score += 1
        ids = sorted(identifier_types & set(spec.identifiers))
        if ids:
            evidence.append(f"{ids[0]} number")
            score += 2
        if score >= MIN_SCORE and (anchors or ids):
            matches.append(DocumentMatch(spec.type, spec.label, spec.group,
                                         confidence=round(min(0.99, 0.5 + score * 0.06), 2),
                                         score=score, evidence=evidence))
    matches.sort(key=lambda m: m.score, reverse=True)
    return matches
