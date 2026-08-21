"""Pure domain result types — NO wire concerns (no responseMode, timestamp,
image version, tool name). Those are the adapter's job (ADR-0002 §3).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Union


@dataclass(frozen=True)
class AuthorityRef:
    cite: str
    kind: Literal["statute", "guidance", "local_code"]
    url: str | None = None


@dataclass(frozen=True)
class TraceStep:
    label: str
    expression: str
    value: float | str


@dataclass(frozen=True)
class PreemptionRef:
    local_value: float
    local_authority: AuthorityRef
    controlling_value: float
    controlling_authority: AuthorityRef
    note: str


@dataclass(frozen=True)
class ComputedOutcome:
    """A computed pass/fail. `authorities` back the numbers used."""

    verdict: Literal["pass", "fail"]
    proposed: float
    required: float
    margin: float
    trace: list[TraceStep]
    authorities: list[AuthorityRef] = field(default_factory=list)
    preemption: PreemptionRef | None = None


@dataclass(frozen=True)
class InsufficientInput:
    """Abstain: the engine cannot answer without the named fields."""

    missing: list[str]


Outcome = Union[ComputedOutcome, InsufficientInput]
