"""The adapter: domain outcome -> validated wire ToolResult.

This is where timestamp/version/responseMode/tool are set (never in rules_core,
never by the model). Uses the clock and env — legal here, forbidden in the pure
core.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

import rules_data
from contract import (
    AbstainResult,
    Authority,
    ComputedResult,
    Preemption,
    ToolResult,
    TraceStep,
    Version,
    parse_tool_result,
)
from rules_core import ComputedOutcome, InsufficientInput, Outcome
from rules_core.domain import AuthorityRef, PreemptionRef
from rules_core.domain import TraceStep as DomainTraceStep


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def current_version() -> Version:
    """Provenance stamped on every result (CONTEXT.md: Version)."""
    return Version(
        image=os.environ.get("IMAGE_TAG", "dev"),
        ruleset=rules_data.load(rules_data.DEMO_CITY).get("version"),
        fixtures=os.environ.get("FIXTURES_VERSION"),
    )


def _authority(ref: AuthorityRef) -> Authority:
    return Authority(cite=ref.cite, kind=ref.kind, url=ref.url)


def _trace(step: DomainTraceStep) -> TraceStep:
    return TraceStep(label=step.label, expression=step.expression, value=step.value)


def _preemption(ref: PreemptionRef) -> Preemption:
    return Preemption(
        local={"value": ref.local_value, "authority": _authority(ref.local_authority)},
        controlling={
            "value": ref.controlling_value,
            "authority": _authority(ref.controlling_authority),
        },
        note=ref.note,
    )


def to_tool_result(tool: str, outcome: Outcome) -> ToolResult:
    """Map a domain outcome to a validated ToolResult. Raises on malformed
    output (fail-closed) — nothing invalid leaves the server."""
    version = current_version()
    timestamp = _now_iso()

    if isinstance(outcome, InsufficientInput):
        model: object = AbstainResult(
            tool=tool,
            version=version,
            timestamp=timestamp,
            missing=outcome.missing,
        )
    elif isinstance(outcome, ComputedOutcome):
        model = ComputedResult(
            tool=tool,
            version=version,
            timestamp=timestamp,
            response_mode="COMPUTED",
            verdict=outcome.verdict,
            proposed=outcome.proposed,
            required=outcome.required,
            margin=outcome.margin,
            trace=[_trace(s) for s in outcome.trace],
            authority=[_authority(a) for a in outcome.authorities] or None,
            preemption=_preemption(outcome.preemption) if outcome.preemption else None,
        )
    else:  # pragma: no cover - exhaustiveness guard
        raise TypeError(f"unmapped outcome type: {type(outcome)!r}")

    # Re-validate through the shared adapter (the produce-side gate, ADR-0001 §4).
    return parse_tool_result(model.model_dump(by_alias=True))  # type: ignore[return-value]


def to_json(tool: str, outcome: Outcome) -> str:
    """The value carried on AG-UI TOOL_CALL_RESULT.content: a JSON string."""
    result = to_tool_result(tool, outcome)
    return result.model_dump_json(by_alias=True)  # type: ignore[attr-defined]
