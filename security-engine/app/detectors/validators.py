"""Checksum / structure validators for Indian identifiers and card numbers.

Validation is what keeps false positives low: a random 12-digit number is not an
Aadhaar unless its Verhoeff check digit is correct.
"""
import re

_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]


def digits_only(value: str) -> str:
    return re.sub(r"\D", "", value)


def verhoeff_valid(number: str) -> bool:
    number = digits_only(number)
    if not number:
        return False
    check = 0
    for i, ch in enumerate(reversed(number)):
        check = _VERHOEFF_D[check][_VERHOEFF_P[i % 8][int(ch)]]
    return check == 0


def aadhaar_valid(value: str) -> bool:
    d = digits_only(value)
    # Aadhaar never starts with 0 or 1 and is not all the same digit.
    return len(d) == 12 and d[0] not in "01" and len(set(d)) > 1 and verhoeff_valid(d)


def iban_valid(value: str) -> bool:
    value = value.replace(" ", "").upper()
    if not re.fullmatch(r"[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}", value):
        return False
    # ISO 13616 mod-97 check. A checksum is not proof of account ownership.
    rearranged = value[4:] + value[:4]
    digits = "".join(str(ord(ch) - 55) if ch.isalpha() else ch for ch in rearranged)
    return int(digits) % 97 == 1


def vid_valid(value: str) -> bool:
    d = digits_only(value)
    return len(d) == 16 and verhoeff_valid(d)


def luhn_valid(value: str) -> bool:
    d = digits_only(value)
    if not 13 <= len(d) <= 19 or len(set(d)) == 1:
        return False
    total = 0
    for i, ch in enumerate(reversed(d)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


# 4th character of a PAN encodes the holder type.
_PAN_HOLDER_TYPES = set("ABCFGHLJPT")


def pan_valid(value: str) -> bool:
    v = value.upper()
    return bool(re.fullmatch(r"[A-Z]{3}[A-Z][A-Z]\d{4}[A-Z]", v)) and v[3] in _PAN_HOLDER_TYPES


_GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def gstin_valid(value: str) -> bool:
    v = value.upper()
    if not re.fullmatch(r"\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]", v):
        return False
    if not pan_valid(v[2:12]):
        return False
    total = 0
    for i, ch in enumerate(v[:14]):
        product = _GSTIN_CHARS.index(ch) * (2 if i % 2 else 1)
        total += product // 36 + product % 36
    check = (36 - total % 36) % 36
    return _GSTIN_CHARS[check] == v[14]
