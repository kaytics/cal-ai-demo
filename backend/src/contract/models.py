"""Pydantic models for the tool-result contract (ADR-0001).

camelCase on the wire (matches the TS/Zod frontend) via `alias_generator`.
The union is discriminated on `verdict`.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter
from pydantic.alias_generators import to_camel

ResponseMode = Literal["COMPUTED", "SOURCED", "MIXED", "ABSTAIN"]
Verdict = Literal[
    "insufficient_input",  # universal abstain
    "pass",
    "fail",  # computed (rules.*)
    "answered",  # sourced (corpus.*)
    # parcel.* eligibility members (eligible / not_eligible / cannot_determine)
    # are added by chunk 04 without changing the envelope.
]


class _Wire(BaseModel):
    """Base: camelCase aliases on the wire, populated by field name in Python."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class Authority(_Wire):
    cite: str
    kind: Literal["statute", "guidance", "local_code"]
    url: str | None = None


class TraceStep(_Wire):
    label: str
    expression: str
    value: float | str


class Version(_Wire):
    image: str
    ruleset: str | None = None
    corpus: str | None = None
    fixtures: str | None = None


class _Base(_Wire):
    tool: str  # e.g. "rules.check_setbacks"
    version: Version
    timestamp: str
    authority: list[Authority] | None = None


class AbstainResult(_Base):
    """The first-class refusal. `missing` names the exact fields needed."""

    verdict: Literal["insufficient_input"] = "insufficient_input"
    response_mode: Literal["ABSTAIN"] = "ABSTAIN"
    missing: list[str] = Field(min_length=1)


class _PreemptionSide(_Wire):
    value: float
    authority: Authority


class Preemption(_Wire):
    local: _PreemptionSide
    controlling: _PreemptionSide
    note: str


class ComputedResult(_Base):
    """Arithmetic pass/fail with a structured trace (rules.* / parcel.*)."""

    verdict: Literal["pass", "fail"]
    response_mode: Literal["COMPUTED", "MIXED"]
    proposed: float
    required: float
    margin: float
    trace: list[TraceStep] = Field(min_length=1)
    preemption: Preemption | None = None


class SourcedResult(_Base):
    """Answer backed by citations, no arithmetic (corpus.*)."""

    verdict: Literal["answered"]
    response_mode: Literal["SOURCED", "MIXED"]
    answer: str
    citations: list[Authority] = Field(min_length=1)


ToolResult = Annotated[
    AbstainResult | ComputedResult | SourcedResult,
    Field(discriminator="verdict"),
]

_ADAPTER: TypeAdapter[object] = TypeAdapter(ToolResult)


def parse_tool_result(data: object) -> object:
    """Fail-closed gate: validate an already-parsed dict / JSON string.

    Raises pydantic.ValidationError on a malformed payload — the boundary
    catches it, nothing downstream renders it.
    """
    if isinstance(data, (str, bytes, bytearray)):
        return _ADAPTER.validate_json(data)
    return _ADAPTER.validate_python(data)
