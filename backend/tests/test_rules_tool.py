"""The rules.* tool over the real MCP layer.

Exercised through an in-memory FastMCP Client against the mounted server, so
the generated INPUT SCHEMA and client-side argument validation are covered —
calling the handler function directly would bypass exactly that layer and hide
a required/optional regression. Notably: omitting `proposed_ft` must be a valid
call that yields an ABSTAIN (ADR-0001 — the honest refusal is a first-class
result), not a transport-level "missing required argument" error."""

from __future__ import annotations

import asyncio
import json

from fastmcp import Client

from mcp_server.app import build_server

TOOL = "rules_check_setbacks"


def _schema() -> dict[str, object]:
    async def go() -> dict[str, object]:
        async with Client(build_server()) as client:
            tools = await client.list_tools()
            (tool,) = [t for t in tools if t.name == TOOL]
            return tool.inputSchema

    return asyncio.run(go())


def _call(arguments: dict[str, object]) -> dict[str, object]:
    async def go() -> dict[str, object]:
        async with Client(build_server()) as client:
            result = await client.call_tool(TOOL, arguments)
            return json.loads(result.data)

    return asyncio.run(go())


def test_proposed_ft_is_optional_in_the_wire_schema() -> None:
    # Only `setback` is required; omitting proposed_ft must be a valid call.
    assert _schema()["required"] == ["setback"]


def test_omitting_proposed_ft_abstains_naming_the_field() -> None:
    result = _call({"setback": "front"})
    assert result["responseMode"] == "ABSTAIN"
    assert result["verdict"] == "insufficient_input"
    assert result["missing"] == ["proposed_ft"]
    # No number is fabricated for the abstaining case.
    assert "proposed" not in result
    assert "required" not in result


def test_full_input_computes_a_verdict() -> None:
    result = _call({"setback": "front", "proposed_ft": 25})
    assert result["responseMode"] == "COMPUTED"
    assert result["verdict"] in {"pass", "fail"}
    assert result["required"] == 20
