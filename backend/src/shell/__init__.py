"""The shared shell (ADR-0002 §5): ASGI app hosting the agent loop + the AG-UI
SSE endpoint the web frontend connects to. Runs as its own process; talks to
the FastMCP server as an MCP client."""

from shell.app import build_app

__all__ = ["build_app"]
