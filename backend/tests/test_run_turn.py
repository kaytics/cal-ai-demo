"""run_turn narration integration (issue #19, seam 2).

Real in-memory MCP produces a real verdict; a FAKE streaming LLM narrates it.
Asserts the outro streams AFTER the card, and that a narrator failure drops the
outro but still finishes the run (the card is the answer, never blocked by prose).
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

from api.agent.loop import Narrator, ToolPlan, run_turn
from api.agent.mcp_client import McpToolClient
from mcp_server.app import build_server

PLAN = ToolPlan(
    tool_name="rules_check_setbacks",
    arguments={"setback": "front", "proposed_ft": 25},
)
IDS = {
    "thread_id": "t",
    "run_id": "r",
    "message_id": "m",
    "tool_call_id": "tc",
}


class _AsyncChunks:
    def __init__(self, deltas: list[str]) -> None:
        self._deltas = deltas

    def __aiter__(self) -> _AsyncChunks:
        self._it = iter(self._deltas)
        return self

    async def __anext__(self) -> object:
        try:
            content = next(self._it)
        except StopIteration as stop:
            raise StopAsyncIteration from stop
        return SimpleNamespace(
            choices=[SimpleNamespace(delta=SimpleNamespace(content=content))], error=None
        )


class FakeStreamingLLM:
    def __init__(self, deltas: list[str]) -> None:
        self._deltas = deltas
        self.chat = SimpleNamespace(send_async=self._send_async)

    async def _send_async(self, **_: object) -> _AsyncChunks:
        return _AsyncChunks(self._deltas)


class FailingLLM:
    def __init__(self) -> None:
        self.chat = SimpleNamespace(send_async=self._send_async)

    async def _send_async(self, **_: object) -> object:
        raise RuntimeError("provider down")


def _drive(llm: object) -> list[str]:
    narrator = Narrator(llm=llm, model="test/model", outro_message_id="outro")

    async def go() -> list[str]:
        mcp = McpToolClient(build_server())
        return [
            frame
            async for frame in run_turn(PLAN, client=mcp, narrator=narrator, **IDS)
        ]

    return asyncio.run(go())


def test_outro_streams_after_the_verdict_card() -> None:
    frames = _drive(FakeStreamingLLM(deltas=["Clears ", "the minimum."]))
    body = "".join(frames)

    verdict_at = body.index("TOOL_CALL_RESULT")
    outro_at = body.index("outro")  # the outro message id
    finished_at = body.index("RUN_FINISHED")

    assert verdict_at < outro_at < finished_at
    assert "Clears " in body and "the minimum." in body


def test_no_tool_plan_emits_prose_only_turn() -> None:
    plan = ToolPlan(tool_name=None, decline="I can only help with setbacks.")

    async def go() -> list[str]:
        return [frame async for frame in run_turn(plan, narrator=None, **IDS)]

    body = "".join(asyncio.run(go()))

    assert body.index("RUN_STARTED") < body.index("I can only help with setbacks.")
    assert "I can only help with setbacks." in body
    assert "RUN_FINISHED" in body
    # A prose-only turn: no tool-call lifecycle and no verdict card.
    assert "TOOL_CALL" not in body


def test_narrator_failure_drops_outro_but_finishes() -> None:
    frames = _drive(FailingLLM())
    body = "".join(frames)

    # Card intact, run still finishes; no outro message emitted.
    assert "TOOL_CALL_RESULT" in body
    assert "RUN_FINISHED" in body
    assert "outro" not in body
