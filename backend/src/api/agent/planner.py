"""The planner: natural language -> ToolPlan (issue #18).

`plan_turn` discovers the MCP tool surface, offers it to an OpenAI-compatible
model as function-calling tools (`tool_choice: auto`), and maps the model's
tool call back into a ToolPlan. The model never computes — it only selects a
tool and extracts arguments (the computation invariant; CONTEXT.md, ADR-0001).
"""

from __future__ import annotations

import json
from typing import Protocol

from api.agent.loop import DEFAULT_DECLINE, ToolPlan
from api.agent.mcp_client import McpToolClient

_SYSTEM = (
    "You select and call exactly one permitting tool for the user's question. "
    "Fill ONLY the arguments you can extract directly from the message. If a "
    "required value (such as a proposed distance) is not stated, LEAVE IT OUT — "
    "never guess, default, fabricate, or invent a value to satisfy the schema. "
    "Omitting an argument is correct: the tool will return an honest refusal "
    "naming exactly what it needs. If no tool fits the question, do not call "
    "one — briefly say you can only help with permitting rules."
)


class _Chat(Protocol):
    async def send_async(self, **kwargs: object) -> object: ...


class ChatLLM(Protocol):
    """The slice of the OpenRouter client the agent needs: `chat.send_async(...)`.
    The real implementation is `openrouter.OpenRouter` (see provider.py), whose
    async API lets the planner (non-streaming) and narrator (streaming) run
    natively on the event loop."""

    chat: _Chat


def _to_openai_tools(mcp_tools: list[object]) -> list[dict[str, object]]:
    """Wrap MCP tools as OpenAI function tools. An MCP `inputSchema` already is
    the JSON Schema OpenAI wants for `parameters`, so this is a thin wrap."""
    tools: list[dict[str, object]] = []
    for tool in mcp_tools:
        parameters = dict(getattr(tool, "inputSchema", None) or {})
        parameters.setdefault("type", "object")
        tools.append(
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": getattr(tool, "description", None) or "",
                    "parameters": parameters,
                },
            }
        )
    return tools


async def plan_turn(
    message: str,
    *,
    mcp: McpToolClient,
    llm: ChatLLM,
    model: str,
) -> ToolPlan:
    """Turn NL `message` into a ToolPlan by letting the model pick an MCP tool."""
    tools = _to_openai_tools(await mcp.list_tools())

    response = await llm.chat.send_async(
        model=model,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": message},
        ],
        tools=tools,
        tool_choice="auto",
        stream=False,
    )

    message = response.choices[0].message
    tool_calls = message.tool_calls
    if not tool_calls:
        # Out of scope: the model returned prose, not a tool call. Decline into
        # a prose-only turn (issue #21) rather than force a call.
        return ToolPlan(tool_name=None, decline=message.content or DEFAULT_DECLINE)

    call = tool_calls[0]
    arguments = json.loads(call.function.arguments)
    return ToolPlan(tool_name=call.function.name, arguments=arguments)
