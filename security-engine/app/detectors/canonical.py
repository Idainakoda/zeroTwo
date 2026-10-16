"""Detection-only Unicode views with offsets back to the unchanged input.

Never strip punctuation from an entire message to find a number: that joins
unrelated identifiers. Numeric candidates below have bounded, explicit gaps.
"""
import re
import unicodedata
from dataclasses import dataclass

from app.normalizer import HOMOGLYPHS


@dataclass(frozen=True)
class TextView:
    text: str
    spans: list[tuple[int, int]]

    def original_span(self, start: int, end: int) -> tuple[int, int]:
        return self.spans[start][0], self.spans[end - 1][1]


def canonicalize(text: str) -> TextView:
    chars, spans = [], []
    for i, ch in enumerate(text):
        if unicodedata.category(ch) == "Cf":
            continue  # zero-width / bidi formatting characters
        for normalized in unicodedata.normalize("NFKC", ch):
            if normalized.isdecimal():
                normalized = str(unicodedata.decimal(normalized))
            else:
                replacement = normalized.lower().translate(HOMOGLYPHS)
                if replacement != normalized.lower():
                    normalized = replacement.upper() if normalized.isupper() else replacement
            for emitted in normalized:
                chars.append(emitted)
                spans.append((i, i + 1))
    return TextView("".join(chars), spans)


# Digit-by-digit speech, not arbitrary cardinal-number prose. Ambiguous "oh"
# is accepted only as part of a full, validated/contextual numeric candidate.
DIGIT_WORDS = {
    "zero": "0", "oh": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
    "shunya": "0", "shoonya": "0", "sifar": "0", "ek": "1", "do": "2",
    "teen": "3", "tin": "3", "char": "4", "chaar": "4", "panch": "5", "paanch": "5",
    "chhe": "6", "cheh": "6", "chhah": "6", "saat": "7", "aath": "8", "nau": "9",
    "शून्य": "0", "जीरो": "0", "एक": "1", "दो": "2", "तीन": "3", "चार": "4",
    "पांच": "5", "पाँच": "5", "छह": "6", "छः": "6", "सात": "7", "आठ": "8", "नौ": "9",
}
WORD_ALTERNATIVES = "|".join(re.escape(w) for w in sorted(DIGIT_WORDS, key=len, reverse=True))
# A digit/word must not be embedded in another word or identifier.
NUMBER_TOKEN = re.compile(
    rf"(?<![\w])(?:(?P<repeat>double|triple)\s+)?(?P<word>{WORD_ALTERNATIVES})(?![\w])|[0-9]+", re.I
)
# At most eight punctuation/whitespace characters between tokens. A comma
# followed by a newline is a record boundary, not a formatting separator.
NUMBER_GAP = re.compile(r"[\s.\-‐‑‒–—―/\\_|,:·•()\[\]]{0,8}\Z")


@dataclass(frozen=True)
class NumberCandidate:
    digits: str
    start: int
    end: int
    spoken: bool
    parts: int = 1          # how many separate tokens the number was assembled from


def number_candidates(text: str) -> list[NumberCandidate]:
    """Maximal bounded runs; never take a 12-digit substring of a longer run."""
    out = []
    run = []
    run_digits = 0

    def emit(items):
        digits = "".join(item[0] for item in items)
        if 4 <= len(digits) <= 19:
            start, end = items[0][1], items[-1][2]
            if ((start == 0 or not text[start - 1].isalnum() and text[start - 1] != "_")
                    and (end == len(text) or not text[end].isalnum() and text[end] != "_")):
                out.append(NumberCandidate(digits, start, end, any(item[3] for item in items), len(items)))
        elif len(digits) > 19 and any(item[4] for item in items[1:]):
            # Too long to be one identifier, so the newlines separate values (a date on one
            # line, an Aadhaar number on the next, as on a scanned card): check each line.
            line: list = []
            for item in items:
                if item[4] and line:
                    emit(line)
                    line = []
                line.append(item)
            emit(line)

    def flush():
        nonlocal run_digits
        if run:
            emit(list(run))
            run.clear()
            run_digits = 0

    for match in NUMBER_TOKEN.finditer(text):
        word = match.group("word")
        digits = DIGIT_WORDS[word.lower()] if word else match.group()
        if match.group("repeat"):
            digits *= 2 if match.group("repeat").lower() == "double" else 3
        gap = text[run[-1][2]:match.start()] if run else ""
        if run:
            # Newlines can wrap a single number; blank lines and record delimiters cannot.
            if (not NUMBER_GAP.fullmatch(gap) or "\n\n" in gap or ("," in gap and "\n" in gap)
                    or ("," in gap and run_digits >= 9)):
                flush()
        run.append((digits, match.start(), match.end(), bool(word), bool(run) and "\n" in gap))
        run_digits += len(digits)
    flush()
    return out
