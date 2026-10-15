"""Synthetic PII/secret regression benchmark, separate from injection accuracy.

Run: python -m evaluation.data_protection
Fixtures and transformations are public regression data, NOT a blind test set
or evidence of general production accuracy. No model downloads or live IDs.
"""
import json
import statistics
import time
from collections import defaultdict

from app.detectors import pii, secrets, validators
from app.redaction import redact, resolve_overlaps

WORDS = "zero one two three four five six seven eight nine".split()


def cases():
    for n in range(20):
        stem = "23456789" + f"{n:03}"
        digits = next(stem + str(check) for check in range(10) if validators.aadhaar_valid(stem + str(check)))
        for separator in ("", " ", "  ", "-", ".", "/", "|", "_", "—", "\n", "\u200b"):
            value = separator.join(digits)
            yield "AADHAAR", "Aadhaar: " + value, value
        value = " ".join(WORDS[int(digit)] for digit in digits)
        yield "AADHAAR", "Aadhaar: " + value, value
    for value in ("ABCPK1234F", "a b c p k 1 2 3 4 f", "ABC\u200bPK1234F"):
        yield "PAN", "PAN: " + value, value
    for value in ("9876543210", "9|8|7|6|5|4|3|2|1|0", "nine eight seven six five four three two one zero"):
        yield "PHONE_IN", "Phone: " + value, value
    for value in ("4111111111111111", "4111.1111.1111.1111"):
        yield "CREDIT_CARD", "Credit card: " + value, value
    for value in ("mango", "correct_horse_battery", "two words with spaces!"):
        yield "PASSWORD", f'password="{value}"', value
    yield "SECRET_VALUE", 'api key="demo-test-value-42"', "demo-test-value-42"
    yield "AUTHORIZATION_TOKEN", "Authorization: Bearer synthetic-token-42", "synthetic-token-42"
    for text in ("My order number is 3847 5629 1034", "What is a merger?", "How do PAN cards work?",
                 "The password is encrypted", "password = user_input", "token_count=4096",
                 "There are one two three four five items", "Appointment: 2026-10-15 at 09:30"):
        yield "BENIGN", text, ""


def run():
    counts = defaultdict(lambda: {"cases": 0, "detected": 0, "fully_redacted": 0})
    tp = fp = tn = fn = leaks = 0
    latency = []
    failures = []
    for index, (type_, text, sensitive) in enumerate(cases()):
        started = time.perf_counter()
        findings = resolve_overlaps(pii.detect(text) + secrets.detect(text))
        masked, _ = redact(text, findings)
        latency.append((time.perf_counter() - started) * 1000)
        positive = type_ != "BENIGN"
        predicted = any(f.severity >= 2 for f in findings)
        if positive:
            matched = any(f.type == type_ and f.start <= text.index(sensitive)
                          and f.end >= text.index(sensitive) + len(sensitive) for f in findings)
            clean = sensitive not in masked
            tp += int(matched)
            fn += int(not matched)
            leaks += int(not clean)
            bucket = counts[type_]
            bucket["cases"] += 1
            bucket["detected"] += int(matched)
            bucket["fully_redacted"] += int(clean)
            if not matched or not clean:
                failures.append({"case": index, "type": type_, "detected": matched, "fully_redacted": clean})
        else:
            fp += int(predicted)
            tn += int(not predicted)
            if predicted:
                failures.append({"case": index, "type": "BENIGN", "false_positive": True})
    latency.sort()
    return {"dataset": "synthetic public regression fixtures; not blind or production accuracy",
            "cases": len(latency), "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
            "entity_precision": tp / (tp + fp) if tp + fp else 0,
            "entity_recall": tp / (tp + fn) if tp + fn else 0,
            "redaction_leaks": leaks, "by_entity": dict(counts),
            "latency_ms": {"median": round(statistics.median(latency), 2),
                           "p95": round(latency[int(.95 * (len(latency) - 1))], 2)},
            "failures": failures}


if __name__ == "__main__":
    report = run()
    print(json.dumps(report, indent=2))
    raise SystemExit(1 if report["failures"] else 0)
