"""The two-method channel emitter."""

from __future__ import annotations

from ag_ui.core import (
    EventType,
    RunFinishedEvent,
    RunStartedEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
    ToolCallArgsEvent,
    ToolCallEndEvent,
    ToolCallResultEvent,
    ToolCallStartEvent,
)
from ag_ui.encoder import EventEncoder

from contract import parse_tool_result


class ChannelEmitter:
    """Encodes AG-UI events as SSE frames. Two methods, two channels — nothing
    else may put content on the wire, so numbers can only travel in a validated
    tool result."""

    def __init__(self, accept: str | None = None) -> None:
        self._encoder = EventEncoder(accept=accept)

    @property
    def content_type(self) -> str:
        return self._encoder.get_content_type()

    # --- run lifecycle -----------------------------------------------------
    def emit_run_started(self, *, thread_id: str, run_id: str) -> str:
        return self._encoder.encode(
            RunStartedEvent(
                type=EventType.RUN_STARTED, thread_id=thread_id, run_id=run_id
            )
        )

    def emit_run_finished(self, *, thread_id: str, run_id: str) -> str:
        return self._encoder.encode(
            RunFinishedEvent(
                type=EventType.RUN_FINISHED, thread_id=thread_id, run_id=run_id
            )
        )

    # --- tool-call lifecycle (precedes emit_verdict) -----------------------
    def emit_tool_start(self, *, tool_call_id: str, tool_name: str) -> str:
        return self._encoder.encode(
            ToolCallStartEvent(
                type=EventType.TOOL_CALL_START,
                tool_call_id=tool_call_id,
                tool_call_name=tool_name,
            )
        )

    def emit_tool_args(self, *, tool_call_id: str, args_json: str) -> str:
        return self._encoder.encode(
            ToolCallArgsEvent(
                type=EventType.TOOL_CALL_ARGS, tool_call_id=tool_call_id, delta=args_json
            )
        )

    def emit_tool_end(self, *, tool_call_id: str) -> str:
        return self._encoder.encode(
            ToolCallEndEvent(type=EventType.TOOL_CALL_END, tool_call_id=tool_call_id)
        )

    def emit_verdict(self, *, message_id: str, tool_call_id: str, result_json: str) -> str:
        """Validate a tool-result JSON string (fail-closed) and frame it on
        TOOL_CALL_RESULT.content. Raises pydantic.ValidationError on a malformed
        payload — it never reaches the client."""
        parse_tool_result(result_json)
        event = ToolCallResultEvent(
            type=EventType.TOOL_CALL_RESULT,
            message_id=message_id,
            tool_call_id=tool_call_id,
            content=result_json,
        )
        return self._encoder.encode(event)

    def emit_prose_start(self, *, message_id: str) -> str:
        return self._encoder.encode(
            TextMessageStartEvent(
                type=EventType.TEXT_MESSAGE_START, message_id=message_id, role="assistant"
            )
        )

    def emit_prose(self, *, message_id: str, delta: str) -> str:
        """Frame a prose delta on TEXT_MESSAGE_CONTENT. No numbers/verdicts by
        discipline — those go through emit_verdict only."""
        return self._encoder.encode(
            TextMessageContentEvent(
                type=EventType.TEXT_MESSAGE_CONTENT, message_id=message_id, delta=delta
            )
        )

    def emit_prose_end(self, *, message_id: str) -> str:
        return self._encoder.encode(
            TextMessageEndEvent(type=EventType.TEXT_MESSAGE_END, message_id=message_id)
        )
