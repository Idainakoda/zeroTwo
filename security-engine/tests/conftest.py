"""Offline-by-default tests: optional model downloads are never test setup."""
import os

os.environ["USE_LLM"] = "false"
os.environ["USE_ML_INJECTION"] = "false"
os.environ["USE_PRESIDIO"] = "false"
# Tests call the engine directly, without the backend's shared key.
os.environ["ENGINE_API_KEY"] = ""
os.environ["ENGINE_ALLOW_NO_KEY"] = "true"
