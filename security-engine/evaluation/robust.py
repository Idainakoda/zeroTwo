"""Robustness evaluation: demanding legitimate prompts vs. attacks written in the same style.

Five categories: complex instruction following / negative constraints, hallucination resistance /
fact verification, multi-step reasoning, structured extraction / transformation, adversarial /
safety alignment.

    .venv\\Scripts\\python -m evaluation.robust              # tuning set (robust_set.json)
    .venv\\Scripts\\python -m evaluation.robust --holdout    # untouched hold-out set

Measures the engine's own decision with the local judge off (the strictest, laptop setting).
"""
import asyncio
import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

from app import config, engine
from app.detectors import pii
from app.detectors.ml_injection import ml
from app.schemas import PromptRequest

HERE = Path(__file__).resolve().parent


async def run_robust(holdout: bool = False) -> dict:
    saved_llm, config.USE_LLM = config.USE_LLM, False
    try:
        pii.presidio.load()
        ml.load()
        data = json.loads((HERE / ("robust_holdout.json" if holdout else "robust_set.json")).read_text(encoding="utf-8"))
        rows = []
        for case in data["cases"]:
            r = await engine.analyze_prompt(PromptRequest(prompt=case["prompt"]))
            rows.append({**case, "decision": r.decision.value, "injection": r.injection_score,
                         "layers": r.layer_scores, "reasons": r.reasons, "ms": r.timing_ms.total})
    finally:
        config.USE_LLM = saved_llm
    return summarise(rows)


def summarise(rows: list[dict]) -> dict:
    per = defaultdict(lambda: {"cases": 0, "exact": 0, "attacks": 0, "blocked": 0, "legit": 0, "false_blocks": 0})
    for r in rows:
        for key in (r["category"], "ALL"):
            s = per[key]
            s["cases"] += 1
            s["exact"] += r["decision"] == r["expect"]
            if r["kind"] == "attack":
                s["attacks"] += 1
                s["blocked"] += r["decision"] == "BLOCK"
            else:
                s["legit"] += 1
                s["false_blocks"] += r["decision"] == "BLOCK"
    table = {}
    for key, s in per.items():
        tp, fn = s["blocked"], s["attacks"] - s["blocked"]
        fp, tn = s["false_blocks"], s["legit"] - s["false_blocks"]
        table[key] = {
            **s,
            "accuracy": round((tp + tn) / s["cases"], 3),
            "exact_decision": round(s["exact"] / s["cases"], 3),
            "recall": round(tp / (tp + fn), 3) if tp + fn else None,
            "precision": round(tp / (tp + fp), 3) if tp + fp else None,
            "false_positive_rate": round(fp / (fp + tn), 3) if fp + tn else None,
        }
    ms = [r["ms"] for r in rows]
    return {
        "metrics": table,
        "latency_ms": {"median": round(statistics.median(ms), 1),
                       "p95": round(sorted(ms)[int(0.95 * (len(ms) - 1))], 1)},
        "errors": [{k: r[k] for k in ("id", "category", "kind", "expect", "decision", "injection", "prompt")}
                   for r in rows if r["decision"] != r["expect"]],
    }


def main() -> None:
    holdout = "--holdout" in sys.argv
    report = asyncio.run(run_robust(holdout))
    print(f"\n{'HOLD-OUT' if holdout else 'TUNING'} robustness set "
          f"(local judge off; latency p50 {report['latency_ms']['median']} ms, p95 {report['latency_ms']['p95']} ms)\n")
    print(f"{'category':14} {'cases':>5} {'accuracy':>9} {'exact':>6} {'attacks blocked':>16} {'legit blocked':>14}")
    order = ["INSTRUCTION", "HALLUCINATION", "REASONING", "EXTRACTION", "ADVERSARIAL", "ALL"]
    for key in [k for k in order if k in report["metrics"]]:
        m = report["metrics"][key]
        print(f"{key:14} {m['cases']:>5} {m['accuracy']:>9.1%} {m['exact_decision']:>6.0%} "
              f"{m['blocked']:>9}/{m['attacks']:<6} {m['false_blocks']:>7}/{m['legit']:<6}")
    if report["errors"]:
        print("\nDifferent from expected:")
        for e in report["errors"]:
            print(f"  {e['id']} {e['kind']:6} expected {e['expect']:8} got {e['decision']:8} "
                  f"inj {e['injection']:.2f} | {e['prompt'][:90]!r}")
    out = HERE / ("robust_holdout_report.json" if holdout else "robust_report.json")
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
