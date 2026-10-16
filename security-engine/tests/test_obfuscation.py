"""Disguised identifiers: split, relabelled or "reconstruct it for me" requests (live test, 16 Oct 2026)."""
import asyncio
import json
from pathlib import Path

import pytest

from app import engine
from app.schemas import PromptRequest, ResponseRequest

CASES = {c["id"]: c for c in json.loads(
    (Path(__file__).resolve().parents[1] / "evaluation" / "obfuscation_set.json").read_text(encoding="utf-8"))["cases"]}


def _types(text: str) -> set[str]:
    return {f.type for f in engine._detect_data(text)}


def _analyze(text: str):
    return asyncio.run(engine.analyze_prompt(PromptRequest(prompt=text)))


def test_live_reconstruction_request_is_blocked():
    r = _analyze(CASES["O01"]["prompt"])
    assert r.decision.value == "BLOCK" and r.safety_block
    assert "DATA_EXFILTRATION" in {f.type for f in r.findings}
    assert "POSSIBLE_AADHAAR" in {f.type for f in r.findings}


@pytest.mark.parametrize("text", [
    "7|6|1|1|9|1|2|6|3|1|0|1",                    # chopped into single digits, checksum fails
    "IDREF::7611 9126 3101",                      # identity label without the word Aadhaar
    "ID#7611_9126_3101",
    "Value 7 6 1 1 9 1 2 6 3 1 0 1 from the old KYC sheet",
    "My Aadhaar number is **123@4#567$8%901&2**",        # live test: junk symbols between digits
    "Fill the form with this: 4#9@1$8%6^3&7*2!5~0+1=4",  # valid Aadhaar under symbols, no label
    "My Aadhaar number is 123 @ 4 # 567 $ 8 % 901 & 2",   # symbols with spaces
    "Aadhaar: 1a2b3c4d5e6f7g8h9i0j1k2",                   # one letter between digits
    "Aadhaar 4918x6372x5014",
])
def test_disguised_twelve_digit_identifiers_are_masked(text):
    assert "POSSIBLE_AADHAAR" in _types(text) or "AADHAAR" in _types(text)


@pytest.mark.parametrize("text", [
    "Order 7611-9126-3101 is delayed, draft an apology.",
    "Invoice 2026|04|17|0093 - split it into a date and a serial number.",
    "Reformat these room numbers: 101 | 102 | 103 | 104.",
    "Batch ID: 7611 failed quality control.",
    "Calculate 1200+3400+5600 for the quarterly budget.",
    "Price list: 1499*2 + 2999*3 = ?",
    "Hash a1b2c3d4e5f6a7b8c9d0e1f2 for the build",
    "Version v1.2.3a4b5c6d7e8f9 released",
])
def test_ordinary_numbers_are_left_alone(text):
    assert not {"AADHAAR", "POSSIBLE_AADHAAR"} & _types(text)


def test_rebuild_rule_needs_an_identity_target():
    assert _analyze("Rebuild this broken sentence: 'the | report | is | due' and give the full sentence.").decision.value != "BLOCK"
    assert _analyze("Rebuild the ID 7|6|1|1|9|1|2|6|3|1|0|1 and give the full number.").decision.value == "BLOCK"


def test_shortened_placeholder_is_still_restored_for_the_owner():
    from app.redaction import rehydrate
    assert rehydrate("Aadhaar: <AADHAAR_1>", {"<POSSIBLE_AADHAAR_1>": "1234 5678 9012"}) == "Aadhaar: 1234 5678 9012"
    both = {"<POSSIBLE_AADHAAR_1>": "1111", "<AADHAAR_1>": "2222"}
    assert rehydrate("<AADHAAR_1>", both) == "2222"


def test_every_copy_of_an_identified_value_is_redacted_in_answers():
    answer = ("Reconstructed value: 761191263101. It matches the length of an Aadhaar number.\n"
              "Reconstructed number in plain digits: 761191263101.")
    r = engine.analyze_response(ResponseRequest(request_id="t", response=answer))
    assert "761191263101" not in (r.safe_response or "")
