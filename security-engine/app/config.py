"""Engine settings, read from environment variables (or a .env file)."""
import os
from pathlib import Path


def _load_dotenv() -> None:
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


# Secret used to hash detected values for audit logs. Change it in production.
HMAC_KEY = os.getenv("ENGINE_HMAC_KEY", "dev-only-change-me").encode()

# Optional shared key that Spring Boot sends in the X-Engine-Key header.
API_KEY = os.getenv("ENGINE_API_KEY", "")

# Presidio NER (person / location names). Falls back to regex-only if unavailable.
USE_PRESIDIO = _bool("USE_PRESIDIO", True)

# Local Llama via Ollama, used only for grey-zone prompts.
USE_LLM = _bool("USE_LLM", True)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
OLLAMA_TIMEOUT_S = float(os.getenv("OLLAMA_TIMEOUT_S", "15"))

# ML injection layers (semantic similarity + classifier). Disable for a light install.
USE_ML_INJECTION = _bool("USE_ML_INJECTION", True)
USE_CLASSIFIER = _bool("USE_CLASSIFIER", True)
SEMANTIC_MODEL = os.getenv("SEMANTIC_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
CLASSIFIER_MODEL = os.getenv("CLASSIFIER_MODEL", "protectai/deberta-v3-base-prompt-injection-v2")
# Optional immutable Hugging Face commit hashes for reproducible deployments.
SEMANTIC_REVISION = os.getenv("SEMANTIC_REVISION") or None
CLASSIFIER_REVISION = os.getenv("CLASSIFIER_REVISION") or None
# Cosine-similarity calibration for the semantic layer.
SEM_LOW = float(os.getenv("SEM_LOW", "0.55"))
SEM_HIGH = float(os.getenv("SEM_HIGH", "0.85"))
SEM_BENIGN_MARGIN = float(os.getenv("SEM_BENIGN_MARGIN", "0.03"))
# How much each ML layer can contribute to the injection score (noisy-OR weights).
W_SEMANTIC = float(os.getenv("W_SEMANTIC", "0.8"))
W_CLASSIFIER = float(os.getenv("W_CLASSIFIER", "0.7"))

# Injection score thresholds (0..1).
INJECTION_BLOCK = float(os.getenv("INJECTION_BLOCK", "0.70"))
INJECTION_GREY_LOW = float(os.getenv("INJECTION_GREY_LOW", "0.30"))

# More distinct personal-data entities than this in one prompt = bulk export.
BULK_PII_LIMIT = int(os.getenv("BULK_PII_LIMIT", "10"))

# How long masked values are kept for re-hydrating the AI response.
VAULT_TTL_S = int(os.getenv("VAULT_TTL_S", "1800"))
