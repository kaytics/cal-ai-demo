"""The planner: NL message -> ToolPlan (issue #18, seam 2).

Exercised with the REAL in-memory MCP surface (so the tool schema the model is
offered is the one the server actually serves) and a FAKE LLM client that
captures what it was handed and returns a canned tool call. No network, no
provider parsing hidden in an untested adapter: plan_turn owns the
OpenAI-shaped call + tool-call parsing, and both are observed here.
"""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

from api.agent.mcp_client import McpToolClient
from api.agent.planner import plan_turn
from mcp_server.app import build_server


class FakeLLM:
    """Minimal stand-in for the OpenRouter client. Records the send() kwargs
    and returns a scripted tool call in the OpenAI response shape."""

    def __init__(self, *, tool_name: str, arguments: dict[str, object]) -> None:
        self._tool_name = tool_name
        self._arguments = arguments
        self.seen_kwargs: dict[str, object] | None = None
        self.chat = SimpleNamespace(send_async=self._send_async)

    async def _send_async(self, **kwargs: object) -> object:
        self.seen_kwargs = kwargs
        tool_call = SimpleNamespace(
            function=SimpleNamespace(
                name=self._tool_name, arguments=json.dumps(self._arguments)
            )
        )
        message = SimpleNamespace(tool_calls=[tool_call], content=None)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def test_plan_turn_maps_nl_to_a_tool_plan_and_offers_the_discovered_tool() -> None:
    llm = FakeLLM(
        tool_name="rules_check_setbacks",
        arguments={"setback": "side", "proposed_ft": 4},
    )
    mcp = McpToolClient(build_server())

    plan = asyncio.run(
        plan_turn(
            "Is a 4 ft side setback allowed?",
            mcp=mcp,
            llm=llm,
            model="test/model",
        )
    )

    # The plan mirrors the model's tool call.
    assert plan.tool_name == "rules_check_setbacks"
    assert plan.arguments == {"setback": "side", "proposed_ft": 4}

    # The tool surface offered to the model came from the real MCP schema.
    kwargs = llm.seen_kwargs or {}
    assert kwargs["model"] == "test/model"
    assert kwargs["tool_choice"] == "auto"
    tools = kwargs["tools"]
    (fn,) = [t["function"] for t in tools if t["function"]["name"] == "rules_check_setbacks"]
    assert set(fn["parameters"]["properties"]) >= {"setback", "proposed_ft"}
    assert fn["parameters"]["required"] == ["setback"]


def test_plan_turn_sends_an_anti_guess_system_prompt() -> None:
    # The planner must instruct the model never to fabricate an argument value
    # (issue #20) — an arg it can't extract is left unset so the tool ABSTAINs.
    llm = FakeLLM(tool_name="rules_check_setbacks", arguments={"setback": "side"})
    mcp = McpToolClient(build_server())

    asyncio.run(plan_turn("Is my side setback ok?", mcp=mcp, llm=llm, model="m"))

    messages = (llm.seen_kwargs or {})["messages"]
    system = next(m["content"] for m in messages if m["role"] == "system").lower()
    assert "guess" in system or "fabricate" in system or "invent" in system
