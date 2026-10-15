"""Type any prompt and see what the security engine decides.

    .venv\\Scripts\\python try_prompt.py

Type a prompt and press Enter. Commands: /multi (paste several lines, end with a line
containing only END), /doc (test text as an uploaded document), /quit.
"""
import asyncio
import logging
import os
import sys

logging.disable(logging.WARNING)

from app import config  # noqa: E402
from app import engine  # noqa: E402
from app.detectors import pii  # noqa: E402
from app.detectors.ml_injection import ml  # noqa: E402
from app.schemas import DocumentRequest, PromptRequest  # noqa: E402

COLORS = {"ALLOW": "\033[92m", "SANITIZE": "\033[93m", "BLOCK": "\033[91m", "QUARANTINE": "\033[91m", "CLEAN": "\033[92m"}
RESET, DIM, BOLD = "\033[0m", "\033[2m", "\033[1m"


def badge(word: str) -> str:
    return f"{COLORS.get(word, '')}{BOLD}{word}{RESET}"


def show_prompt(res) -> None:
    print(f"\n  Decision : {badge(res.decision.value)}    risk {res.risk_score}/100    "
          f"injection score {res.injection_score:.2f}")
    for r in res.reasons:
        print(f"  Why      : {r}")
    if res.findings:
        print("  Findings :")
        for f in res.findings:
            what = f.preview or f.reason
            print(f"     - {f.category.value:<12} {f.type:<26} conf {f.confidence:.2f}  {DIM}{f.detector}{RESET}  {what}")
    L = res.layer_scores or {}
    if L:
        def fmt(v):
            return "off" if v is None else f"{v:.2f}"
        print(f"  Layers   : rules {fmt(L.get('rules'))} | semantic {fmt(L.get('semantic'))} | "
              f"classifier {fmt(L.get('classifier'))} | final {fmt(L.get('fused'))}")
    if res.llm.called:
        print(f"  Llama    : {res.llm.reason}")
    if res.sanitized_prompt:
        print(f"  Sent to AI as:\n     {res.sanitized_prompt}")
    print(f"  {DIM}Time: {res.timing_ms.total:.0f} ms{RESET}\n")


def show_doc(res) -> None:
    c = res.chunks[0]
    print(f"\n  Document : {badge('QUARANTINE' if c.quarantined else 'CLEAN')}    injection score {c.injection_score:.2f}")
    for f in c.findings:
        print(f"     - {f.category.value:<12} {f.type:<26} conf {f.confidence:.2f}  {f.preview or f.reason}")
    if res.spotlighted_context:
        print(f"  Passed to AI as:\n     {res.spotlighted_context}")
    print()


def read_multiline() -> str:
    print("  Paste text, then type END on its own line:")
    lines = []
    while True:
        line = input()
        if line.strip() == "END":
            return "\n".join(lines)
        lines.append(line)


async def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if os.name == "nt":
        os.system("")                               # enable colours in Windows terminals
    print("Loading models (first time takes ~20-40 s)...")
    pii.presidio.load()
    ml.load()
    print(f"Ready. presidio={pii.presidio.ready} semantic={ml.ready} classifier={ml.classifier is not None} "
          f"local_llama={config.USE_LLM}")
    print("Type a prompt and press Enter.  /multi = several lines   /doc = test as document   /quit = exit\n")
    while True:
        try:
            text = input(f"{BOLD}prompt>{RESET} ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not text:
            continue
        if text == "/quit":
            break
        if text == "/multi":
            text = read_multiline()
        if text == "/doc":
            doc = read_multiline()
            show_doc(engine.analyze_document(DocumentRequest(chunks=[doc])))
            continue
        show_prompt(await engine.analyze_prompt(PromptRequest(prompt=text)))


if __name__ == "__main__":
    asyncio.run(main())
