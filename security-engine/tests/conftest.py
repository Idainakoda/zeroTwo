"""Offline-by-default tests: optional model downloads are never test setup."""
import os

os.environ["USE_LLM"] = "false"
os.environ["USE_ML_INJECTION"] = "false"
os.environ["USE_PRESIDIO"] = "false"
