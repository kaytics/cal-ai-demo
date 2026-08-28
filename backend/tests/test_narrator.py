"""The narrator: streamed post-call prose over a tool result (issue #19, seam 1).

A FAKE async-streaming LLM stands in for `client.chat.send_async(stream=True)`;
narrate() consumes the async chunk stream and yields text deltas. No network.
The narrator reads/explains the tool's numbers; it never computes (the
computation invariant — CONTEXT.md, ADR-0001 amendment).
"""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

from api.agent.narrator import narrate


class _AsyncChunks:
    """Mimics EventStreamAsync[ChatStreamChunk]: async-iterates chunk objects
    shaped like the OpenRouter SDK's (choices[0].delta.content, optional error)."""

    def __init__(self, deltas: list[str | None]) -> None:
        self._deltas = deltas

    def __aiter__(self) -> _AsyncChunks:
        self._it = iter(self._deltas)
        return self

    async def __anext__(self) -> object:
        try:
            content = next(self._it)
        except StopIteration as stop:
            raise StopAsyncIteration from stop
        delta = SimpleNamespace(content=content)
        return SimpleNamespace(choices=[SimpleNamespace(delta=delta)], error=None)


class FakeStreamingLLM:
    def __init__(self, deltas: list[str | None]) -> None:
        self._deltas = deltas
        self.seen_kwargs: dict[str, object] | None = None
        self.chat = SimpleNamespace(send_async=self._send_async)

    async def _send_async(self, **kwargs: object) -> _AsyncChunks:
        self.seen_kwargs = kwargs
        return _AsyncChunks(self._deltas)


def test_narrate_streams_deltas_grounded_on_the_full_result() -> None:
    result_json = json.dumps(
        {
            "tool": "rules_check_setbacks",
            "responseMode": "COMPUTED",
            "verdict": "pass",
            "required": 20,
            "proposed": 25,
            "margin": 5,
            "trace": [{"label": "margin", "expression": "25 - 20", "value": 5}],
        }
    )
    # A content-free chunk (the SDK's trailing usage chunk) must be skipped.
    llm = FakeStreamingLLM(deltas=["The proposed ", "setback clears the minimum.", None])

    async def go() -> list[str]:
        return [d async for d in narrate(result_json, llm=llm, model="test/model")]

    deltas = asyncio.run(go())

    assert deltas == ["The proposed ", "setback clears the minimum."]

    kwargs = llm.seen_kwargs or {}
    assert kwargs["stream"] is True
    assert kwargs["model"] == "test/model"
    messages = kwargs["messages"]
    system = next(m["content"] for m in messages if m["role"] == "system")
    assert "comput" in system.lower()  # forbids computation
    # Grounded on the full tool result (including the trace) — verbatim.
    assert any(result_json in m["content"] for m in messages if m["role"] != "system")
