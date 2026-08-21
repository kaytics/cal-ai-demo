"""corpus.* retrieval — hybrid SQL + RRF + temporal filter (chunk C).

This is the ONLY module permitted to own a DB connection pool (ADR-0002 §7).
rules_core / mcp_server.rules must never import a DB driver.
"""

from __future__ import annotations

# TODO(chunk C): hybrid SQL + reciprocal-rank-fusion retrieval with a temporal
# filter, returning a SourcedResult (verdict="answered") via the adapter.

__all__: list[str] = []
