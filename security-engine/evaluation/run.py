"""Runs the evaluation set through the engine and reports detection metrics.

Usage (from the security-engine folder):
    .venv\\Scripts\\python -m evaluation.run            # uses the local LLM if Ollama is running
    .venv\\Scripts\\python -m evaluation.run --no-llm   # rule layers only
"""
import argparse
import asyncio
import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

from app import config, engine
from app.detectors import pii
from app.detectors.ml_injection import ml
from app.schemas import DocumentRequest, PromptRequest, ResponseRequest

HERE = Path(__file__).resolve().parent
NEGATIVE = {"ALLOW", "CLEAN"}


async def _run_case(case: dict) -> dict:
    kind = case["kind"]
    if kind == "prompt":
        res = await engine.analyze_prompt(PromptRequest(prompt=case["text"]))
        got = res.decision.value
        latency = res.timing_ms.total - res.timing_ms.llm      # gateway overhead without the LLM call
        detail = {"reasons": res.reasons, "llm_called": res.llm.called,
                  "types": sorted({f.type for f in res.findings})}
    elif kind == "document":
        res = engine.analyze_document(DocumentRequest(chunks=[case["text"]]))
        got = "QUARANTINE" if res.quarantined else "CLEAN"
        latency = res.timing_ms
        detail = {"types": sorted({f.type for c in res.chunks for f in c.findings})}
    else:   # response: run the prompt first so the vault holds the canary and placeholders
        p = await engine.analyze_prompt(PromptRequest(prompt=case["prompt"]))
        canary = p.system_prompt_addon.split("internal reference ")[1].split("]")[0] if p.system_prompt_addon else ""
        res = engine.analyze_response(ResponseRequest(request_id=p.request_id,
                                                      response=case["text"].replace("{CANARY}", canary)))
        got = res.decision.value
        latency = res.timing_ms
        detail = {"reasons": res.reasons, "types": sorted({f.type for f in res.findings})}
        if case.get("must_contain") and (res.safe_response or "").find(case["must_contain"]) < 0:
            got = "REHYDRATION_FAILED"
    return {"id": case["id"], "kind": kind, "label": case["label"], "subset": case["subset"],
            "expected": case["expected"], "got": got, "latency_ms": round(latency, 2), **detail}


def _pct(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    idx = min(len(values) - 1, max(0, round(q * (len(values) - 1))))
    return round(values[idx], 2)


def _metrics(results: list[dict]) -> dict:
    tp = fp = tn = fn = 0
    for r in results:
        actual_pos = r["expected"] not in NEGATIVE
        pred_pos = r["got"] not in NEGATIVE
        if actual_pos and pred_pos:
            tp += 1
        elif actual_pos:
            fn += 1
        elif pred_pos:
            fp += 1
        else:
            tn += 1
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    exact = sum(r["expected"] == r["got"] for r in results)
    lat = [r["latency_ms"] for r in results]

    by_subset: dict[str, dict] = defaultdict(lambda: {"total": 0, "correct": 0})
    for r in results:
        s = by_subset[r["subset"]]
        s["total"] += 1
        s["correct"] += int(r["expected"] == r["got"])
    return {
        "total": len(results),
        "legitimate": tn + fp,
        "adversarial": tp + fn,
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "detection_accuracy": round((tp + tn) / len(results), 4) if results else 0,
        "decision_accuracy": round(exact / len(results), 4) if results else 0,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "false_positive_rate": round(fp / (fp + tn), 4) if fp + tn else 0.0,
        "latency_ms": {"p50": _pct(lat, 0.5), "p95": _pct(lat, 0.95), "max": round(max(lat), 2) if lat else 0,
                       "mean": round(statistics.mean(lat), 2) if lat else 0},
        "by_subset": {k: {**v, "accuracy": round(v["correct"] / v["total"], 4)} for k, v in sorted(by_subset.items())},
    }


async def run_all(path: Path = HERE / "testset.json") -> dict:
    pii.presidio.load()
    ml.load()
    cases =json.loads(path.read_text(encoding="utf-8"))["cases"]
    await engine.analyze_prompt(PromptRequest(prompt="warm-up"))   # load models before timing
    results = [await _run_case(c) for c in cases]
    return {
        "config": {"presidio": pii.presidio.ready, "local_llm": config.USE_LLM, "model": config.OLLAMA_MODEL,
                   "semantic": ml.ready, "classifier": ml.classifier is not None},
        "metrics": _metrics(results),
        "misses": [r for r in results if r["expected"] != r["got"]],
        "results": results,
    }


def _print_report(report: dict) -> None:
    m = report["metrics"]
    c = m["confusion"]
    print("\n=== CyberCup Security Engine - Evaluation ===")
    cfg = report["config"]
    print(f"Config: presidio={cfg['presidio']}  semantic={cfg['semantic']}  classifier={cfg['classifier']}  "
          f"local_llm={cfg['local_llm']}")
    print(f"Cases: {m['total']}  (legitimate {m['legitimate']}, adversarial {m['adversarial']})")
    print(f"Confusion: TP={c['tp']} FP={c['fp']} TN={c['tn']} FN={c['fn']}")
    print(f"Detection accuracy : {m['detection_accuracy']:.1%}")
    print(f"Decision accuracy  : {m['decision_accuracy']:.1%}   (exact ALLOW/SANITIZE/BLOCK match)")
    print(f"Precision {m['precision']:.1%} | Recall {m['recall']:.1%} | F1 {m['f1']:.1%} | FPR {m['false_positive_rate']:.1%}")
    lat = m["latency_ms"]
    print(f"Added latency (engine only): p50 {lat['p50']} ms | p95 {lat['p95']} ms | max {lat['max']} ms")
    print("\nBy subset:")
    for name, s in m["by_subset"].items():
        print(f"  {name:<15} {s['correct']:>3}/{s['total']:<3} {s['accuracy']:.0%}")
    if report["misses"]:
        print("\nMisses:")
        for r in report["misses"]:
            print(f"  {r['id']:<4} expected {r['expected']:<10} got {r['got']:<10} {r.get('reasons', r.get('types'))}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-llm", action="store_true", help="disable the local Llama layer")
    parser.add_argument("--no-ml", action="store_true", help="disable the semantic + classifier layers")
    args = parser.parse_args()
    if args.no_llm:
        config.USE_LLM = False
    if args.no_ml:
        config.USE_ML_INJECTION = False
    report = asyncio.run(run_all())
    out = HERE / "report.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    _print_report(report)
    print(f"\nFull report: {out}")


if __name__ == "__main__":
    main()
