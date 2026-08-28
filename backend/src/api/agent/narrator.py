"""The narrator: streamed post-call prose over a tool result (issue #19).

After the tool call, `narrate` streams a natural-language "outro" describing the
result. It is grounded on the full tool result (including `trace`) so it can
explain the "why" — but it NEVER computes: all arithmetic already happened in
the pure MCP tool, and the narrator only reads/explains the numbers it was
handed (the computation invariant; CONTEXT.md, ADR-0001 amendment). Enforced by
the strict system prompt below, not a wiring guard.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from api.agent.planner import ChatLLM

_SYSTEM = (
    "You are narrating the result of a permitting rule check. A deterministic "
    "tool has already done all the computation and produced the JSON result you "
    "are given. NEVER compute, recompute, or invent a number: only state numbers "
    "that appear verbatim in the result, and explain the convention or authority "
    "behind them. The card already shows the figures — your job is a short, plain "
    "narration of what the result means. If a field is missing, say what is "
    "needed; never guess."
)


async def narrate(
    result_json: str,
    *,
    llm: ChatLLM,
    model: str,
) -> AsyncIterator[str]:
    """Yield the outro token-by-token, grounded on `result_json`.

    Raises if the provider stream reports a mid-stream error, so the caller
    (`run_turn`) can drop the outro and still finish the run cleanly."""
    stream = await llm.chat.send_async(
        model=model,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": result_json},
        ],
        stream=True,
    )

    async for chunk in stream:
        if getattr(chunk, "error", None):
            raise RuntimeError("narrator stream error")
        content = chunk.choices[0].delta.content
        if content:
            yield content
