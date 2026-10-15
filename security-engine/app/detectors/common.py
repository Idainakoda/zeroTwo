"""Helpers shared by all detectors."""
import hashlib
import hmac
import math
import re
from collections import Counter

from app import config


def value_hash(value: str) -> str:
    """Keyed hash of a detected value: lets the audit log count repeats without storing the value."""
    canonical = re.sub(r"[\s\-]", "", value).upper()
    return hmac.new(config.HMAC_KEY, canonical.encode(), hashlib.sha256).hexdigest()[:32]


def preview(value: str, keep: int = 4) -> str:
    """Mask everything except the last `keep` alphanumerics, keeping separators."""
    alnum_positions = [i for i, ch in enumerate(value) if ch.isalnum()]
    visible = set(alnum_positions[-keep:]) if len(alnum_positions) > keep * 2 else set()
    return "".join(ch if (i in visible or not ch.isalnum()) else "X" for i, ch in enumerate(value))


def shannon_entropy(value: str) -> float:
    if not value:
        return 0.0
    counts = Counter(value)
    n = len(value)
    return -sum(c / n * math.log2(c / n) for c in counts.values())


def has_context(text: str, start: int, end: int, pattern: re.Pattern, window: int = 40) -> bool:
    lo = max(0, start - window)
    hi = min(len(text), end + window)
    return bool(pattern.search(text[lo:hi]))


PLACEHOLDER = re.compile(r"<[A-Z_]+_\d+>|\[REDACTED:[A-Z_]+\]")


def inside_placeholder(text: str, start: int, end: int) -> bool:
    for m in PLACEHOLDER.finditer(text):
        if m.start() <= start and end <= m.end():
            return True
    return False
