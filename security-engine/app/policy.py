"""Loads policy.yaml (default engine recommendations)."""
from dataclasses import dataclass, field
from pathlib import Path

import yaml

POLICY_FILE = Path(__file__).resolve().parent.parent / "policy.yaml"


@dataclass
class Policy:
    block_types: set[str] = field(default_factory=set)
    sanitize_min_severity: int = 2
    codenames: list[str] = field(default_factory=list)
    output_leak_phrases: list[str] = field(default_factory=list)

    @classmethod
    def load(cls, path: Path = POLICY_FILE) -> "Policy":
        data = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
        data = data or {}
        return cls(
            block_types=set(data.get("block_types", [])),
            sanitize_min_severity=int(data.get("sanitize_min_severity", 2)),
            codenames=list(data.get("codenames", [])),
            output_leak_phrases=[p.lower() for p in data.get("output_leak_phrases", [])],
        )


policy = Policy.load()


def reload() -> Policy:
    fresh = Policy.load()
    policy.__dict__.update(fresh.__dict__)
    return policy
