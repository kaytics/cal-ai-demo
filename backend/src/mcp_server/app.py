"""Build the FastMCP server (single-server topology, ADR-0002 §5/§7).

Currently hosts rules.*. parcel.* (chunk 04) and corpus.* (chunk C) register
here later; corpus is the only module that may own a DB pool.
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
