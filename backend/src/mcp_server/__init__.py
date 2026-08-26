"""FastMCP server + adapter (ADR-0002 §2, §4, §5).

The adapter maps a pure `domains.rules.core` domain outcome into the wire `ToolResult`,
stamps timestamp/version, sets responseMode/tool, and validates against the
Pydantic contract before returning (fail-closed). Imports `contract` (produce
side); must NOT import a DB driver from the rules namespace (import-linter).
"""

from mcp_server.app import build_server

__all__ = ["build_server"]
