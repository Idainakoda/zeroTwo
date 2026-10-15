"""Text normalisation for robust detection.

Attackers hide instructions with Unicode tricks, spacing, leetspeak or encodings.
We never modify the original prompt here; we build extra "views" of it that the
injection rules scan in addition to the original text.
"""
import base64
import binascii
import codecs
import re
import unicodedata
from dataclasses import dataclass, field

ZERO_WIDTH = re.compile("[​‌‍⁠⁡⁢⁣⁤﻿­᠎]")

# Cyrillic / Greek letters that look like Latin ones.
HOMOGLYPHS = str.maketrans({
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "і": "i",
    "ј": "j", "ѕ": "s", "ԁ": "d", "ӏ": "l", "ο": "o", "α": "a", "ε": "e", "ι": "i",
    "ν": "v", "τ": "t", "κ": "k", "ρ": "p", "υ": "u",
})

LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"})

# "i g n o r e" / "i.g.n.o.r.e" / "i-g-n-o-r-e"
SPACED_LETTERS = re.compile(r"\b(?:[a-z][\s.\-_*]){3,}[a-z]\b")
BASE64_CANDIDATE = re.compile(r"[A-Za-z0-9+/]{16,}={0,2}")
HEX_CANDIDATE = re.compile(r"\b(?:[0-9a-fA-F]{2}){10,}\b")


@dataclass
class NormalizedText:
    original: str
    views: dict[str, str] = field(default_factory=dict)   # name -> text to scan
    hidden_chars: int = 0
    decoded_payloads: int = 0


def _printable_ratio(text: str) -> float:
    if not text:
        return 0.0
    ok = sum(1 for ch in text if ch.isprintable() or ch in "\n\t")
    return ok / len(text)


def _looks_like_language(text: str) -> bool:
    return _printable_ratio(text) > 0.95 and len(re.findall(r"[a-zA-Z]{3,}", text)) >= 3


def _decode_segments(text: str) -> list[str]:
    decoded = []
    for match in BASE64_CANDIDATE.finditer(text):
        chunk = match.group(0)
        try:
            raw = base64.b64decode(chunk + "=" * (-len(chunk) % 4), validate=False)
            candidate = raw.decode("utf-8")
        except (binascii.Error, UnicodeDecodeError, ValueError):
            continue
        if _looks_like_language(candidate):
            decoded.append(candidate)
    for match in HEX_CANDIDATE.finditer(text):
        try:
            candidate = bytes.fromhex(match.group(0)).decode("utf-8")
        except (ValueError, UnicodeDecodeError):
            continue
        if _looks_like_language(candidate):
            decoded.append(candidate)
    return decoded


def basic_clean(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = ZERO_WIDTH.sub("", text)
    text = text.translate(HOMOGLYPHS)
    return re.sub(r"\s+", " ", text).strip().lower()


def normalize(text: str) -> NormalizedText:
    result = NormalizedText(original=text)
    result.hidden_chars = len(ZERO_WIDTH.findall(text))

    clean = basic_clean(text)
    result.views["clean"] = clean

    collapsed = SPACED_LETTERS.sub(lambda m: re.sub(r"[\s.\-_*]", "", m.group(0)), clean)
    if collapsed != clean:
        result.views["collapsed"] = collapsed

    leet = collapsed.translate(LEET)
    if leet != collapsed:
        result.views["leet"] = leet

    decoded = _decode_segments(unicodedata.normalize("NFKC", ZERO_WIDTH.sub("", text)))
    if decoded:
        result.decoded_payloads = len(decoded)
        result.views["decoded"] = basic_clean(" \n ".join(decoded))

    result.views["rot13"] = codecs.encode(clean, "rot13")
    result.views["reversed"] = clean[::-1]
    return result
