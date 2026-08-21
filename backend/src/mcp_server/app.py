"""Build the FastMCP server hosting all namespaces (single-server topology,
ADR-0002 §5/§7). corpus.* is registered separately and owns the only DB pool.
"""

from __future__ import annotations

from fastmcp import FastMCP

from mcp_server import rules


def build_server() -> FastMCP:
    mcp = FastMCP(name="cal-permitting")
    rules.register(mcp)
    # parcel.register(mcp)   # chunk 04
    # corpus.register(mcp)   # chunk C — the only module that imports a DB driver
    return mcp
