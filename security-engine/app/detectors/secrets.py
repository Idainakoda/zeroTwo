"""Credential and secret detection: known key formats, password assignments and entropy."""
import re

from app.detectors.common import inside_placeholder, preview, shannon_entropy, value_hash
from app.schemas import Category, Finding

# (type, pattern, severity, confidence, redactable)
KEY_PATTERNS = [
    ("PRIVATE_KEY", r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY(?: BLOCK)?-----|$)", 4, 0.99, False),
    ("AWS_ACCESS_KEY", r"\b(?:AKIA|ASIA|AGPA|AIDA|AROA)[0-9A-Z]{16}\b", 4, 0.97, True),
    ("AWS_SECRET_KEY", r"(?i)aws.{0,25}(?:secret|private).{0,10}[:=]\s*['\"]?([A-Za-z0-9/+=]{40})\b", 4, 0.95, True),
    ("ANTHROPIC_KEY", r"\bsk-ant-[A-Za-z0-9_\-]{20,}", 4, 0.98, True),
    ("OPENAI_KEY", r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_\-]{20,}", 4, 0.95, True),
    ("GROQ_KEY", r"\bgsk_[A-Za-z0-9]{20,}", 4, 0.98, True),
    ("GOOGLE_API_KEY", r"\bAIza[0-9A-Za-z_\-]{35}\b", 4, 0.97, True),
    ("GITHUB_TOKEN", r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{22,}", 4, 0.98, True),
    ("SLACK_TOKEN", r"\bxox[abprs]-[0-9A-Za-z\-]{10,}", 4, 0.97, True),
    ("HUGGINGFACE_TOKEN", r"\bhf_[A-Za-z0-9]{30,}\b", 4, 0.97, True),
    ("STRIPE_KEY", r"\b(?:sk|rk|pk)_(?:live|test)_[0-9A-Za-z]{20,}", 4, 0.97, True),
    ("RAZORPAY_KEY", r"\brzp_(?:live|test)_[0-9A-Za-z]{10,}", 4, 0.97, True),
    ("JWT", r"\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}", 3, 0.93, True),
    ("CONNECTION_STRING", r"\b(?:mysql|postgres(?:ql)?|mongodb(?:\+srv)?|redis|amqp|mssql|jdbc:[a-z]+)://[^\s:/@]+:[^\s@]+@[^\s]+", 4, 0.97, True),
]
_COMPILED = [(t, re.compile(p), s, c, r) for t, p, s, c, r in KEY_PATTERNS]

PASSWORD_ASSIGN = re.compile(
    r"(?i)\b(password|passwd|pwd|passcode|pass|secret|token|api[_\-]?key|access[_\-]?key|client[_\-]?secret|pin)"
    r"\s*(?:[:=]|=>|is|was|hai|:-)\s*['\"]?([^\s'\",;]{4,})"
)
PLACEHOLDER_VALUES = re.compile(
    r"^(?:\*+|x+|\.+|<[^>]*>|\{[^}]*\}|\$\{?[A-Z_]+\}?|%[A-Z_]+%|your[_\-]?\w*|changeme|example\w*|"
    r"password|secret|token|none|null|empty|required|incorrect|wrong|expired|invalid|not|reset|forgotten|"
    r"strong|weak|correct|same|different|case|sensitive|mandatory|optional|os\.environ.*|env\(.*|getenv.*|process\.env.*)$",
    re.I,
)
ENTROPY_CANDIDATE = re.compile(r"(?<![A-Za-z0-9+/_\-])[A-Za-z0-9+/_\-]{24,}={0,2}(?![A-Za-z0-9+/_\-])")


def _strong_value(value: str) -> bool:
    has_digit = any(ch.isdigit() for ch in value)
    has_symbol = any(not ch.isalnum() for ch in value)
    mixed_case = any(ch.isupper() for ch in value) and any(ch.islower() for ch in value)
    return has_digit or has_symbol or mixed_case


def detect(text: str) -> list[Finding]:
    findings: list[Finding] = []
    taken: list[tuple[int, int]] = []

    def overlaps(s: int, e: int) -> bool:
        return any(s < te and ts < e for ts, te in taken)

    for type_, regex, severity, confidence, redactable in _COMPILED:
        for m in regex.finditer(text):
            group = 1 if m.lastindex else 0
            s, e = m.span(group)
            if overlaps(s, e) or inside_placeholder(text, s, e):
                continue
            value = m.group(group)
            taken.append((s, e))
            findings.append(Finding(
                category=Category.SECRET, type=type_, severity=severity, confidence=confidence,
                start=s, end=e, detector="secret-signature", redactable=redactable,
                preview=preview(value[:12], 2) + ("…" if len(value) > 12 else ""), value_hash=value_hash(value),
            ))

    for m in PASSWORD_ASSIGN.finditer(text):
        s, e = m.span(2)
        value = m.group(2)
        if overlaps(s, e) or inside_placeholder(text, s, e) or PLACEHOLDER_VALUES.match(value):
            continue
        # Code like `password = user_input` or `token = request.headers.get(` is not a secret.
        if re.search(r"[()\[\]]", value) or re.fullmatch(r"[A-Za-z_][A-Za-z_.]*", value):
            continue
        if not _strong_value(value):
            continue
        taken.append((s, e))
        findings.append(Finding(
            category=Category.SECRET, type="PASSWORD", severity=4, confidence=0.88,
            start=s, end=e, detector="secret-assignment", redactable=True,
            preview="*" * min(len(value), 8), value_hash=value_hash(value),
            reason=f"value assigned to '{m.group(1).lower()}'",
        ))

    for m in ENTROPY_CANDIDATE.finditer(text):
        s, e = m.span()
        value = m.group(0)
        if overlaps(s, e) or inside_placeholder(text, s, e):
            continue
        has_letters = any(ch.isalpha() for ch in value)
        has_digits = any(ch.isdigit() for ch in value)
        if not (has_letters and has_digits):
            continue
        if re.fullmatch(r"[0-9a-fA-F\-]+", value):   # hashes, UUIDs, commit ids
            continue
        entropy = shannon_entropy(value)
        if entropy < 4.2:
            continue
        taken.append((s, e))
        findings.append(Finding(
            category=Category.SECRET, type="HIGH_ENTROPY_SECRET", severity=3, confidence=0.7,
            start=s, end=e, detector="entropy", redactable=True,
            preview=preview(value[:12], 2) + "…", value_hash=value_hash(value),
            reason=f"random-looking token, entropy {entropy:.1f} bits/char",
        ))
    return findings
