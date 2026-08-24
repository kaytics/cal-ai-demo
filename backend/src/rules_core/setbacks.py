"""rules.check_setbacks — the vertical-slice engine.

Minimum-setback check with state preemption. Margin convention (CONTEXT.md):
for minimums, margin = proposed - required; negative fails; proposed == required
passes. Pure: reads only baked YAML via rules_data.
"""

from __future__ import annotations

from typing import Any

import rules_data
from rules_core.domain import (
    AuthorityRef,
    ComputedOutcome,
    InsufficientInput,
    Outcome,
    PreemptionRef,
    TraceStep,
)

_VALID_SETBACKS = ("front", "side", "rear")


def _authority(raw: dict[str, Any]) -> AuthorityRef:
    return AuthorityRef(cite=raw["cite"], kind=raw["kind"], url=raw.get("url"))


def check_setbacks(inputs: dict[str, Any]) -> Outcome:
    """Check a proposed setback distance against the controlling minimum.

    Expected inputs: {"setback": "front"|"side"|"rear", "proposed_ft": number}.
    Missing/invalid required fields -> InsufficientInput (abstain), never a guess.
    """
    missing: list[str] = []
    setback = inputs.get("setback")
    proposed = inputs.get("proposed_ft")
    if setback not in _VALID_SETBACKS:
        missing.append("setback")
    if not isinstance(proposed, (int, float)) or isinstance(proposed, bool):
        missing.append("proposed_ft")
    if missing:
        return InsufficientInput(missing=missing)

    proposed = float(proposed)
    city = rules_data.load(rules_data.DEMO_CITY)
    local_rule = city["setbacks"][setback]
    local_required = float(local_rule["min_ft"])
    local_auth = _authority(local_rule["authority"])

    authorities = [local_auth]
    trace = [
        TraceStep(
            label="Local minimum",
            expression=f"{setback} setback ≥ {local_required} ft",
            value=local_required,
        )
    ]

    # State preemption: a state cap on the max a locality may require.
    required = local_required
    preemption: PreemptionRef | None = None
    state = rules_data.load(rules_data.STATE_RULES)
    cap_rule = state.get("preemptions", {}).get(setback)
    if cap_rule is not None:
        cap = float(cap_rule["max_local_required_ft"])
        if local_required > cap:
            state_auth = _authority(cap_rule["authority"])
            required = cap
            authorities.append(state_auth)
            preemption = PreemptionRef(
                local_value=local_required,
                local_authority=local_auth,
                controlling_value=cap,
                controlling_authority=state_auth,
                note=(
                    f"State law caps the required {setback} setback at {cap} ft, "
                    f"preempting the local {local_required} ft minimum."
                ),
            )
            trace.append(
                TraceStep(
                    label="State preemption",
                    expression=f"required = min({local_required}, {cap})",
                    value=cap,
                )
            )

    margin = proposed - required
    verdict = "pass" if margin >= 0 else "fail"
    trace.append(
        TraceStep(
            label="Margin",
            expression=f"{proposed} − {required}",
            value=margin,
        )
    )

    return ComputedOutcome(
        verdict=verdict,
        proposed=proposed,
        required=required,
        margin=margin,
        trace=trace,
        authorities=authorities,
        preemption=preemption,
    )
