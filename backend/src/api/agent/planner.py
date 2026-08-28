"""The planner: natural language -> ToolPlan (issue #18).

`plan_turn` discovers the MCP tool surface, offers it to an OpenAI-compatible
model as function-calling tools (`tool_choice: auto`), and maps the model's
tool call back into a ToolPlan. The model never computes — it only selects a
tool and extracts arguments (the computation invariant; CONTEXT.md, ADR-0001).
"""

from __future__ import annotations

import functools
import json
from typing import Protocol

import anyio

from api.agent.loop import ToolPlan
from api.agent.mcp_client import McpToolClient


class _Chat(Protocol):
    def send(self, **kwargs: object) -> object: ...


class ChatLLM(Protocol):
    """The slice of the OpenRouter client the planner needs: `chat.send(...)`.
    The real implementation is the official (synchronous) `openrouter.OpenRouter`
    client (see provider.py); the blocking call is offloaded to a thread."""

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

    # The official OpenRouter SDK is synchronous; keep the event loop free.
    response = await anyio.to_thread.run_sync(
        functools.partial(
            llm.chat.send,
            model=model,
            messages=[{"role": "user", "content": message}],
            tools=tools,
            tool_choice="auto",
        )
    )

    call = response.choices[0].message.tool_calls[0]
    arguments = json.loads(call.function.arguments)
    return ToolPlan(tool_name=call.function.name, arguments=arguments)
