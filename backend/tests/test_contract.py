"""The adapter produces a valid ToolResult; the fail-closed gate rejects
malformed payloads (ADR-0001 §4)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from contract import AbstainResult, ComputedResult, parse_tool_result
from mcp_server.envelope import to_json, to_tool_result
from rules_core import check_setbacks


def test_adapter_maps_computed_with_preemption() -> None:
    outcome = check_setbacks({"setback": "side", "proposed_ft": 4})
    result = to_tool_result("rules.check_setbacks", outcome)
    assert isinstance(result, ComputedResult)
    assert result.verdict == "pass"
    assert result.response_mode == "COMPUTED"
    assert result.required == 4
    assert result.preemption is not None
    assert result.tool == "rules.check_setbacks"
    assert result.version.image  # stamped by the adapter, not the core


def test_adapter_maps_abstain() -> None:
    outcome = check_setbacks({"setback": "front"})
    result = to_tool_result("rules.check_setbacks", outcome)
    assert isinstance(result, AbstainResult)
    assert result.response_mode == "ABSTAIN"
    assert result.missing == ["proposed_ft"]


def test_to_json_roundtrips_through_the_gate() -> None:
    outcome = check_setbacks({"setback": "front", "proposed_ft": 25})
    payload = to_json("rules.check_setbacks", outcome)
    # camelCase on the wire; re-parses cleanly through the shared gate.
    assert '"responseMode"' in payload
    parse_tool_result(payload)


def test_gate_rejects_malformed() -> None:
    with pytest.raises(ValidationError):
        parse_tool_result('{"verdict": "pass"}')  # missing required envelope
