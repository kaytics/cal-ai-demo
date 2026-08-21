"""The pure rules engine.

Imports NOTHING but `rules_data` (baked YAML) and stdlib types. No contract,
no adapters, no DB, no clock, no env, no randomness (ADR-0002 §3, §7; enforced
by import-linter). Returns a DOMAIN result — the adapter maps it to the wire
contract and stamps timestamp/version/responseMode.
"""

from rules_core.domain import (
    AuthorityRef,
    ComputedOutcome,
    InsufficientInput,
    Outcome,
    PreemptionRef,
    TraceStep,
)
from rules_core.setbacks import check_setbacks

__all__ = [
    "AuthorityRef",
    "ComputedOutcome",
    "InsufficientInput",
    "Outcome",
    "PreemptionRef",
    "TraceStep",
    "check_setbacks",
]
