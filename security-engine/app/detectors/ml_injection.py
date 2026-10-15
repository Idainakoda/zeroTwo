"""ML layers for prompt-injection detection, to catch reworded attacks the rules miss.

L2  Classifier: protectai/deberta-v3-base-prompt-injection-v2 (English, runs on CPU).
L3  Semantic similarity: multilingual MiniLM embeddings compared with a library of known
    attacks AND of legitimate look-alike prompts (attack_library.json). Works for English,
    Hindi and Hinglish, and for paraphrases.

Both models are loaded once at start-up. If they are unavailable, the engine falls back
to rules only and /health reports it.
"""
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

from app import config

log = logging.getLogger(__name__)
LIBRARY = Path(__file__).resolve().parent / "attack_library.json"

def token_windows(text: str, tokenizer, max_tokens: int, overlap: int = 48) -> list[str]:
    """Cover the entire input with overlapping windows, before model truncation.

    Fast-tokenizer offsets keep original characters intact. No first-N windows
    limit: batching limits memory without silently dropping the end of a prompt.
    """
    if not text.strip():
        return []
    budget = max(16, min(max_tokens, 512) - tokenizer.num_special_tokens_to_add(pair=False))
    offsets = tokenizer(text, add_special_tokens=False, truncation=False,
                        return_offsets_mapping=True)["offset_mapping"]
    if not offsets:
        return []
    step = max(1, budget - min(overlap, budget // 4))
    windows = []
    for start in range(0, len(offsets), step):
        end = min(len(offsets), start + budget)
        windows.append(text[offsets[start][0]:offsets[end - 1][1]])
        if end == len(offsets):
            break
    return windows


def _mostly_latin(text: str) -> bool:
    letters = [ch for ch in text if ch.isalpha()]
    if not letters:
        return True
    return sum(ch.isascii() for ch in letters) / len(letters) >= 0.6


@dataclass
class MlResult:
    semantic: float = 0.0          # 0..1, calibrated
    semantic_label: str = ""
    nearest_attack: float = 0.0    # raw cosine similarity
    nearest_benign: float = 0.0
    classifier: float = 0.0        # probability of INJECTION
    ms: dict = field(default_factory=dict)


class _MlInjection:
    def __init__(self):
        self.embedder = None
        self.classifier = None
        self.attack_vecs = None
        self.attack_labels: list[str] = []
        self.benign_vecs = None
        self.error = ""

    @property
    def ready(self) -> bool:
        return self.embedder is not None or self.classifier is not None

    def load(self) -> None:
        if not config.USE_ML_INJECTION or self.ready:
            return
        try:
            import torch
            from sentence_transformers import SentenceTransformer

            torch.set_num_threads(max(1, min(4, torch.get_num_threads())))
            self.embedder = SentenceTransformer(config.SEMANTIC_MODEL, device="cpu", revision=config.SEMANTIC_REVISION)
            lib = json.loads(LIBRARY.read_text(encoding="utf-8"))
            attacks = [(label, text) for label, items in lib["attacks"].items() for text in items]
            self.attack_labels = [label for label, _ in attacks]
            self.attack_vecs = self.embedder.encode([t for _, t in attacks], normalize_embeddings=True, show_progress_bar=False,
                                                    convert_to_tensor=True)
            self.benign_vecs = self.embedder.encode(lib["benign"], normalize_embeddings=True, show_progress_bar=False,
                                                    convert_to_tensor=True)
            log.info("Semantic layer loaded (%d attack / %d benign examples)", len(attacks), len(lib["benign"]))
        except Exception as exc:  # pragma: no cover - depends on environment
            self.embedder = None
            self.error = f"semantic: {exc}"
            log.warning("Semantic layer unavailable: %s", exc)
        if config.USE_CLASSIFIER:
            try:
                from transformers import pipeline

                self.classifier = pipeline("text-classification", model=config.CLASSIFIER_MODEL,
                                           revision=config.CLASSIFIER_REVISION,
                                           truncation=True, max_length=512, device=-1)
                log.info("Injection classifier loaded")
            except Exception as exc:  # pragma: no cover
                self.classifier = None
                self.error = f"classifier: {exc}"
                log.warning("Injection classifier unavailable: %s", exc)

    @staticmethod
    def _calibrate(attack_sim: float, benign_sim: float) -> float:
        """Map raw cosine similarity to a 0..1 score.

        Below SEM_LOW nothing is reported; at SEM_HIGH the score is ~0.95. If a legitimate
        example is as close as the nearest attack, the score is halved.
        """
        lo, hi = config.SEM_LOW, config.SEM_HIGH
        if attack_sim <= lo:
            return 0.0
        score = 0.3 + 0.65 * min(1.0, (attack_sim - lo) / max(0.001, hi - lo))
        if benign_sim >= attack_sim - config.SEM_BENIGN_MARGIN:
            score *= 0.5
        return round(score, 3)

    def analyze(self, texts: list[str]) -> MlResult:
        """texts: the original prompt plus any decoded views (base64 etc.)."""
        result = MlResult()
        if not self.ready:
            return result
        if self.embedder is not None:
            from sentence_transformers import util

            t = time.perf_counter()
            segments = [window for text in texts for window in token_windows(
                text, self.embedder.tokenizer, self.embedder.max_seq_length)]
            best = 0.0
            for offset in range(0, len(segments), 16):
                batch = segments[offset:offset + 16]
                vecs = self.embedder.encode(batch, normalize_embeddings=True, show_progress_bar=False, convert_to_tensor=True)
                att = util.cos_sim(vecs, self.attack_vecs)
                ben = util.cos_sim(vecs, self.benign_vecs)
                for i in range(len(batch)):
                    j = int(att[i].argmax())
                    a, b = float(att[i][j]), float(ben[i].max())
                    s = self._calibrate(a, b)
                    if s > best or (best == 0 and a > result.nearest_attack):
                        result.nearest_attack, result.nearest_benign = round(a, 3), round(b, 3)
                        if s > best:
                            best, result.semantic_label = s, self.attack_labels[j]
            result.semantic = best
            result.ms["semantic"] = round((time.perf_counter() - t) * 1000, 2)

        # The classifier was trained on English only; on Devanagari text it misfires, so
        # Hindi-script prompts rely on the multilingual semantic layer and the rules.
        if self.classifier is not None:
            t = time.perf_counter()
            clf_inputs = [window for text in texts
                          for window in token_windows(text, self.classifier.tokenizer, 512)
                          if _mostly_latin(window)]
            probs = []
            for offset in range(0, len(clf_inputs), 8):
                for out in self.classifier(clf_inputs[offset:offset + 8], batch_size=8):
                    p = out["score"] if out["label"].upper() == "INJECTION" else 1 - out["score"]
                    probs.append(p)
            result.classifier = round(max(probs, default=0.0), 3)
            result.ms["classifier"] = round((time.perf_counter() - t) * 1000, 2)
        return result


ml = _MlInjection()
