"""Entry point: run the FastMCP server over streamable-HTTP (ADR-0002 §4/§5).

    uv run mcp-server
"""

from __future__ import annotations

import os

from mcp_server.app import build_server


def main() -> None:
    host = os.environ.get("MCP_HOST", "127.0.0.1")
    port = int(os.environ.get("MCP_PORT", "8000"))
    build_server().run(transport="streamable-http", host=host, port=port)


if __name__ == "__main__":
    main()
