"""The turn loop: drive a ToolPlan -> call tool over MCP -> emit AG-UI stream.

`run_turn` is planner-agnostic: it takes a `ToolPlan` and drives the real MCP
hop + the channel-split emitter. The plan is produced by `api.agent.planner`
(NL tool-use over OpenRouter, issue #18).
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import TYPE_CHECKING

from api.agent.mcp_client import McpToolClient
from api.agui import ChannelEmitter

_log = logging.getLogger(__name__)

if TYPE_CHECKING:
    from api.agent.planner import ChatLLM


@dataclass(frozen=True)
class ToolPlan:
    """What to call. Produced by the planner (api.agent.planner) from NL input."""

    tool_name: str
    arguments: dict[str, object]
    intro: str = "Checking the applicable rule…"


@dataclass(frozen=True)
class Narrator:
    """Everything the post-call narrator needs (issue #19). Passed to `run_turn`
    as one optional unit — the three fields always travel and are checked
    together."""

    llm: ChatLLM
    model: str
    outro_message_id: str


async def run_turn(
    plan: ToolPlan,
    *,
    thread_id: str,
    run_id: str,
    message_id: str,
    tool_call_id: str,
    client: McpToolClient | None = None,
    emitter: ChannelEmitter | None = None,
    narrator: Narrator | None = None,
) -> AsyncIterator[str]:
    """Drive one turn, yielding AG-UI SSE frames. The number only ever appears
    inside the validated tool result on the TOOL_CALL_RESULT channel.

    When `narrator` is given, it streams a post-call "outro" (issue #19) after
    the verdict. Narration is best-effort: any failure drops the outro but the
    run still finishes cleanly — the card is the answer and must never be
    blocked by prose."""
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

    # Post-call narration (issue #19): stream the outro grounded on the result.
    if narrator is not None:
        async for frame in _narrate(result_json, emitter=emitter, narrator=narrator):
            yield frame

    yield emitter.emit_run_finished(thread_id=thread_id, run_id=run_id)


async def _narrate(
    result_json: str,
    *,
    emitter: ChannelEmitter,
    narrator: Narrator,
) -> AsyncIterator[str]:
    """Stream the narrator outro on its own prose message. Best-effort: on any
    failure, close the message if opened and emit nothing further — the caller
    still finishes the run. No outro frames are emitted until a first delta
    arrives, so a pre-stream failure leaves no empty message behind."""
    from api.agent.narrator import narrate

    mid = narrator.outro_message_id
    started = False
    try:
        async for delta in narrate(result_json, llm=narrator.llm, model=narrator.model):
            if not started:
                started = True
                yield emitter.emit_prose_start(message_id=mid)
            yield emitter.emit_prose(message_id=mid, delta=delta)
    except Exception:  # noqa: BLE001 — best-effort: never block the card on prose
        _log.warning("narrator failed; dropping outro", exc_info=True)
    finally:
        if started:
            yield emitter.emit_prose_end(message_id=mid)
