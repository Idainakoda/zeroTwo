"""Blind robustness test: unseen attacks vs. unseen legitimate look-alikes.

Shows what each injection layer adds (ablation):
    .venv\\Scripts\\python -m evaluation.blind
"""
import asyncio
import json
import sys
from pathlib import Path

from app import config, engine
from app.detectors import pii
from app.detectors.ml_injection import ml
from app.schemas import PromptRequest

HERE = Path(__file__).resolve().parent
CONFIGS = {
    "rules only": (True, False, False),
    "rules + semantic": (True, True, False),
    "rules + classifier": (True, False, True),
    "rules + semantic + classifier": (True, True, True),
}


async def collect() -> tuple[list[dict], list[dict]]:
    saved_llm, config.USE_LLM = config.USE_LLM, False      # measure the fast layers only
    try:
        return await _collect()
    finally:
        config.USE_LLM = saved_llm


async def _collect() -> tuple[list[dict], list[dict]]:
    pii.presidio.load()
    ml.load()
    data = json.loads((HERE / "blind_set.json").read_text(encoding="utf-8"))
    out = {}
    for kind in ("attacks", "legit"):
        rows = []
        for text in data[kind]:
            r = await engine.analyze_prompt(PromptRequest(prompt=text))
            rows.append({"text": text, "decision": r.decision.value, "layers": r.layer_scores,
                         "ms": r.timing_ms.total})
        out[kind] = rows
    return out["attacks"], out["legit"]


def score(row: dict, use: tuple[bool, bool, bool]) -> float:
    L = row["layers"]
    return engine.fuse_injection(L["rules"] if use[0] else 0, (L.get("semantic") or 0) if use[1] else 0,
                                 (L.get("classifier") or 0) if use[2] else 0, L.get("educational_framing", False))


async def run_blind() -> dict:
    """Same ablation as main(), returned as data for the dashboard."""
    attacks, legit = await collect()
    block, grey = config.INJECTION_BLOCK, config.INJECTION_GREY_LOW
    rows = []
    for name, use in CONFIGS.items():
        a = [score(r, use) for r in attacks]
        g = [score(r, use) for r in legit]
        rows.append({"layers": name, "attacks_blocked": sum(s >= block for s in a), "attacks_to_llm": sum(grey <= s < block for s in a),
                     "legit_blocked": sum(s >= block for s in g), "legit_to_llm": sum(grey <= s < block for s in g)})
    full = CONFIGS["rules + semantic + classifier"]
    ms = sorted(r["ms"] for r in attacks + legit)
    return {"attacks": len(attacks), "legit": len(legit), "table": rows,
            "missed": [r["text"] for r in attacks if score(r, full) < block],
            "false_blocks": [r["text"] for r in legit if score(r, full) >= block],
            "latency_ms": {"p50": round(ms[len(ms) // 2]), "p95": round(ms[int(len(ms) * 0.95)])}}


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    attacks, legit = asyncio.run(collect())
    block, grey = config.INJECTION_BLOCK, config.INJECTION_GREY_LOW
    print(f"\n=== Blind robustness set: {len(attacks)} unseen attacks, {len(legit)} unseen legitimate ===")
    print(f"{'layers':<32}{'blocked':>10}{'+ to Llama':>12}{'false blocks':>14}{'legit to Llama':>16}")
    for name, use in CONFIGS.items():
        a = [score(r, use) for r in attacks]
        g = [score(r, use) for r in legit]
        print(f"{name:<32}{sum(s >= block for s in a):>5}/{len(a):<4}"
              f"{sum(grey <= s < block for s in a):>12}"
              f"{sum(s >= block for s in g):>9}/{len(g):<4}"
              f"{sum(grey <= s < block for s in g):>16}")
    full = CONFIGS["rules + semantic + classifier"]
    print("\nAttacks still not blocked (full stack):")
    for r in attacks:
        if score(r, full) < block:
            L = r["layers"]
            print(f"  fused {score(r, full):.2f}  rules {L['rules']:.2f} sem {L.get('semantic') or 0:.2f} "
                  f"clf {L.get('classifier') or 0:.2f}  {r['text'][:70]}")
    print("\nLegitimate prompts blocked or sent to Llama (full stack):")
    for r in legit:
        s = score(r, full)
        if s >= grey:
            L = r["layers"]
            print(f"  fused {s:.2f}  rules {L['rules']:.2f} sem {L.get('semantic') or 0:.2f} "
                  f"clf {L.get('classifier') or 0:.2f}  {r['text'][:70]}")
    ms = sorted(r["ms"] for r in attacks + legit)
    print(f"\nEngine latency with ML layers: p50 {ms[len(ms) // 2]:.0f} ms | p95 {ms[int(len(ms) * 0.95)]:.0f} ms")


if __name__ == "__main__":
    main()
