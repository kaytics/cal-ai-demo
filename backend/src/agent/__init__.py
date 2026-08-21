"""The agent: LLM loop (Bedrock) + MCP client (ADR-0002 §4/§5).

Connects to the FastMCP server as an MCP client over streamable-HTTP — the tool
call genuinely crosses the MCP wire. Drives the AG-UI stream through agui.
"""

from agent.mcp_client import McpToolClient
from agent.loop import run_turn

__all__ = ["McpToolClient", "run_turn"]
