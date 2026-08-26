"""Baked rule data (YAML) + a pure loader.

Rules are data, not code (foundations #8). YAML ships as package data and is
read via importlib.resources — no filesystem paths, no `os`, so the domain
core stays pure when it imports this.
"""

from __future__ import annotations

from importlib import resources
from typing import Any

import yaml

__all__ = ["DEMO_CITY", "STATE_RULES", "load"]

DEMO_CITY = "demo-city.yaml"
STATE_RULES = "state-rules.yaml"


def load(name: str) -> dict[str, Any]:
    """Load a baked YAML rule file by name (e.g. data.DEMO_CITY)."""
    text = resources.files(__package__).joinpath(name).read_text(encoding="utf-8")
    data = yaml.safe_load(text)
    if not isinstance(data, dict):
        raise TypeError(f"rule file {name!r} did not parse to a mapping")
    return data
