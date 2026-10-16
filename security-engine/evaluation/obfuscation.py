"""Obfuscated-identifier evaluation: split / spelled / re-encoded identifiers and "reconstruct it for me"
requests, plus legitimate look-alikes.

    .venv\\Scripts\\python -m evaluation.obfuscation

An attack is protected when the request is blocked, or when the secret value (compared digit by
digit, ignoring formatting) no longer appears in the masked prompt that would be forwarded.
"""
import asyncio
import json
import re
from pathlib import Path

from app import config, engine
from app.detectors import pii
from app.detectors.canonical import canonicalize
from app.detectors.ml_injection import ml
from app.schemas import PromptRequest

HERE = Path(__file__).resolve().parent


def _squash(text: str) -> str:
    """Digits and letters only, in canonical form (Devanagari / full-width digits become ASCII)."""
    return re.sub(r"[^0-9A-Z]", "", canonicalize(text or "").text.upper())


async def run_obfuscation() -> dict:
    saved, config.USE_LLM = config.USE_LLM, False
    try:
        pii.presidio.load()
        ml.load()
        cases = json.loads((HERE / "obfuscation_set.json").read_text(encoding="utf-8"))["cases"]
        rows = []
        for c in cases:
            r = await engine.analyze_prompt(PromptRequest(prompt=c["prompt"]))
            forwarded = None if r.decision.value == "BLOCK" else (r.masked_prompt or "")
            leaked = bool(c["secret"]) and forwarded is not None and c["secret"].upper() in _squash(forwarded)
            if c["expect"] == "BLOCK":
                ok = r.decision.value == "BLOCK"
            elif c["expect"] == "PROTECT":
                ok = r.decision.value == "BLOCK" or (r.decision.value == "SANITIZE" and not leaked)
            else:
                ok = r.decision.value != "BLOCK"
            rows.append({**c, "decision": r.decision.value, "leaked": leaked, "ok": ok,
                         "injection": r.injection_score, "types": sorted({f.type for f in r.findings})})
    finally:
        config.USE_LLM = saved
    attacks = [r for r in rows if r["kind"] == "attack"]
    legit = [r for r in rows if r["kind"] == "legit"]
    return {
        "attacks_protected": sum(r["ok"] for r in attacks), "attacks": len(attacks),
        "legit_ok": sum(r["ok"] for r in legit), "legit": len(legit),
        "legit_masked": sum(r["decision"] == "SANITIZE" for r in legit),
        "failures": [{k: r[k] for k in ("id", "kind", "expect", "decision", "leaked", "injection", "types")}
                     for r in rows if not r["ok"]],
    }


def main() -> None:
    rep = asyncio.run(run_obfuscation())
    print(f"\nObfuscated identifiers: {rep['attacks_protected']}/{rep['attacks']} attacks protected, "
          f"{rep['legit_ok']}/{rep['legit']} legitimate prompts not blocked "
          f"({rep['legit_masked']} of them masked)")
    for f in rep["failures"]:
        print("  FAIL", f)


if __name__ == "__main__":
    main()
