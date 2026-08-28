"""MCP client over streamable-HTTP to the FastMCP server."""

from __future__ import annotations

import os

from fastmcp import Client


def server_url() -> str:
    host = os.environ.get("MCP_HOST", "127.0.0.1")
    port = os.environ.get("MCP_PORT", "8000")
    return os.environ.get("MCP_URL", f"http://{host}:{port}/mcp")


class McpToolClient:
    """Thin wrapper: call a namespaced tool and return its raw JSON-string
    result (the value destined for AG-UI TOOL_CALL_RESULT.content).

    `target` is anything fastmcp's Client accepts: the streamable-HTTP URL in
    production, or an in-memory FastMCP server in tests."""

    def __init__(self, target: object | None = None) -> None:
        self._target = target if target is not None else server_url()

    async def call(self, name: str, arguments: dict[str, object]) -> str:
        async with Client(self._target) as client:
            result = await client.call_tool(name, arguments)
        return _extract_text(result)

    async def list_tools(self) -> list[object]:
        """The tool surface the planner offers the model (name, description,
        inputSchema per entry)."""
        async with Client(self._target) as client:
            return await client.list_tools()


def _extract_text(result: object) -> str:
    # fastmcp CallToolResult: prefer structured `.data`, fall back to first
    # text content block.
    data = getattr(result, "data", None)
    if isinstance(data, str):
        return data
    content = getattr(result, "content", None)
    if content:
        text = getattr(content[0], "text", None)
        if isinstance(text, str):
            return text
    raise ValueError("MCP tool result had no string content")
