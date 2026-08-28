"""The turn loop: drive a ToolPlan -> call tool over MCP -> emit AG-UI stream.

`run_turn` is planner-agnostic: it takes a `ToolPlan` and drives the real MCP
hop + the channel-split emitter. The plan is produced by `api.agent.planner`
(NL tool-use over OpenRouter, issue #18).
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass

from api.agent.mcp_client import McpToolClient
from api.agui import ChannelEmitter


@dataclass(frozen=True)
class ToolPlan:
    """What to call. Produced by the planner (api.agent.planner) from NL input."""

    tool_name: str
    arguments: dict[str, object]
    intro: str = "Checking the applicable rule…"


async def run_turn(
    plan: ToolPlan,
    *,
    thread_id: str,
    run_id: str,
    message_id: str,
    tool_call_id: str,
    client: McpToolClient | None = None,
    emitter: ChannelEmitter | None = None,
) -> AsyncIterator[str]:
    """Drive one turn, yielding AG-UI SSE frames. The number only ever appears
    inside the validated tool result on the TOOL_CALL_RESULT channel."""
    client = client or McpToolClient()
    emitter = emitter or ChannelEmitter()

    yield emitter.emit_run_started(thread_id=thread_id, run_id=run_id)

    # Prose channel: narration only, never a number/verdict.
    yield emitter.emit_prose_start(message_id=message_id)
    yield emitter.emit_prose(message_id=message_id, delta=plan.intro)
    yield emitter.emit_prose_end(message_id=message_id)

    # Tool-call lifecycle + the real MCP hop.
    yield emitter.emit_tool_start(tool_call_id=tool_call_id, tool_name=plan.tool_name)
    yield emitter.emit_tool_args(
        tool_call_id=tool_call_id, args_json=json.dumps(plan.arguments)
    )
    yield emitter.emit_tool_end(tool_call_id=tool_call_id)

    result_json = await client.call(plan.tool_name, plan.arguments)

    # Verdict channel: validated (fail-closed) then framed on TOOL_CALL_RESULT.
    yield emitter.emit_verdict(
        message_id=message_id, tool_call_id=tool_call_id, result_json=result_json
    )

    yield emitter.emit_run_finished(thread_id=thread_id, run_id=run_id)
