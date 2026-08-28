"""The /agui/run NL endpoint (issue #18, seam 3).

End-to-end over the real in-memory MCP + emitter, with a FAKE LLM so no
network. Proves the Ask path: an NL `message` is planned, the tool runs, and
the channel-split stream carries the verdict card. `message` is required.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

from starlette.testclient import TestClient

from api.agent.mcp_client import McpToolClient
from api.app import build_app
from mcp_server.app import build_server


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


class FakeLLM:
    """Handles both agent calls on one client: planning (stream=False -> a
    tool-call result) and narration (stream=True -> streamed outro deltas)."""

    def __init__(
        self,
        *,
        tool_name: str,
        arguments: dict[str, object],
        outro: list[str] | None = None,
    ) -> None:
        self._tool_name = tool_name
        self._arguments = arguments
        self._outro = outro or ["Narrated ", "outro."]
        self.chat = SimpleNamespace(send_async=self._send_async)

    async def _send_async(self, **kwargs: object) -> object:
        if kwargs.get("stream"):
            return _AsyncChunks(self._outro)
        call = SimpleNamespace(
            function=SimpleNamespace(
                name=self._tool_name, arguments=json.dumps(self._arguments)
            )
        )
        message = SimpleNamespace(tool_calls=[call], content=None)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def _client(llm: FakeLLM) -> TestClient:
    app = build_app(
        llm=llm,
        model="test/model",
        mcp=McpToolClient(build_server()),
        narrator_model="test/model",
    )
    return TestClient(app)


def test_ask_message_streams_the_verdict_card_frames() -> None:
    llm = FakeLLM(
        tool_name="rules_check_setbacks",
        arguments={"setback": "front", "proposed_ft": 25},
        outro=["The proposed setback ", "clears the minimum."],
    )
    resp = _client(llm).post("/agui/run", json={"message": "Is a 25 ft front setback ok?"})

    assert resp.status_code == 200
    body = resp.text
    for token in ("RUN_STARTED", "TOOL_CALL_START", "TOOL_CALL_RESULT", "RUN_FINISHED"):
        assert token in body
    # The number rides only on the validated tool result.
    assert "COMPUTED" in body
    # The narrator outro streams after the card and before the run finishes.
    assert "clears the minimum." in body
    assert body.index("TOOL_CALL_RESULT") < body.index("clears the minimum.") < body.index(
        "RUN_FINISHED"
    )


def test_missing_message_is_a_400() -> None:
    llm = FakeLLM(tool_name="rules_check_setbacks", arguments={})
    resp = _client(llm).post("/agui/run", json={})
    assert resp.status_code == 400
