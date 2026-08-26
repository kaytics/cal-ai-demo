"""AG-UI emitter (ADR-0002 §6, research #8).

Wraps ag-ui-protocol's EventEncoder in a two-method emitter so the channel
split is unbreakable: emit_verdict -> TOOL_CALL_RESULT only; emit_prose ->
TEXT_MESSAGE_* only. The encoder does NOT validate, so emit_verdict runs a
Pydantic fail-closed gate (contract.parse_tool_result) before serializing the
result string into `content` — the receive-side validation of ADR-0001 §4.
"""

from api.agui.emitter import ChannelEmitter

__all__ = ["ChannelEmitter"]
