"""Build the FastMCP server (single-server topology, ADR-0002 §5/§7).

Currently hosts rules.*. parcel.* (chunk 04) and corpus.* (chunk C) register
here later; corpus is the only module that may own a DB pool.
"""

from fastmcp import FastMCP

from mcp_server.rules import rule


def build_server() -> FastMCP:
    app = FastMCP("cal-permitting")
    app.mount(rule, namespace="rules")
    # app.mount(corpus, namespace="corpus")  # chunk C — owns the only DB pool
    # app.mount(parcel, namespace="parcel")  # chunk 04
    return app
