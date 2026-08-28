"""rules.* tool registrations. Namespaced tool names (foundations #15).

Handlers call the pure engine and hand the outcome to the adapter. This module
must never import a DB driver (import-linter: mcp_server.rules).
"""

from __future__ import annotations

from typing import Annotated

from fastmcp import FastMCP
from pydantic import Field

from domains.rules import core
from mcp_server.envelope import to_json

rule = FastMCP("Rules")


@rule.tool
def check_setbacks(
    setback: Annotated[
        str, Field(description="Which setback: 'front', 'side', or 'rear'.")
    ],
    proposed_ft: Annotated[
        float | None,
        Field(description="Proposed setback distance in feet. Omit to receive an ABSTAIN naming it as the missing input."),
    ] = None,
) -> str:
    """Check a proposed setback against the controlling minimum (local +
    state preemption). Returns the tool-result contract as a JSON string.

    `proposed_ft` is optional at the boundary so the honest-refusal path is
    reachable over the wire: omitting it yields an ABSTAIN result naming the
    missing field, rather than a transport-level validation error (ADR-0001 —
    ABSTAIN is a first-class result)."""
    outcome = core.check_setbacks(
        {"setback": setback, "proposed_ft": proposed_ft}
    )
    # Wire name is `rules_check_setbacks` (mount namespace + underscore separator,
    # ADR-0002). The `tool` field on the contract matches it.
    return to_json("rules_check_setbacks", outcome)
