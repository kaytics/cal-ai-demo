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


class FakeLLM:
    def __init__(self, *, tool_name: str, arguments: dict[str, object]) -> None:
        self._tool_name = tool_name
        self._arguments = arguments
        self.chat = SimpleNamespace(send=self._send)

    def _send(self, **_: object) -> object:
        call = SimpleNamespace(
            function=SimpleNamespace(
                name=self._tool_name, arguments=json.dumps(self._arguments)
            )
        )
        message = SimpleNamespace(tool_calls=[call], content=None)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def _client(llm: FakeLLM) -> TestClient:
    app = build_app(
        llm=llm, model="test/model", mcp=McpToolClient(build_server())
    )
    return TestClient(app)


def test_ask_message_streams_the_verdict_card_frames() -> None:
    llm = FakeLLM(
        tool_name="rules_check_setbacks",
        arguments={"setback": "front", "proposed_ft": 25},
    )
    resp = _client(llm).post("/agui/run", json={"message": "Is a 25 ft front setback ok?"})

    assert resp.status_code == 200
    body = resp.text
    for token in ("RUN_STARTED", "TOOL_CALL_START", "TOOL_CALL_RESULT", "RUN_FINISHED"):
        assert token in body
    # The number rides only on the validated tool result.
    assert "COMPUTED" in body


def test_missing_message_is_a_400() -> None:
    llm = FakeLLM(tool_name="rules_check_setbacks", arguments={})
    resp = _client(llm).post("/agui/run", json={})
    assert resp.status_code == 400
