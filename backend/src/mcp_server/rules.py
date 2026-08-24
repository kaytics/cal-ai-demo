"""rules.* tool registrations. Namespaced tool names (foundations #15).

Handlers call the pure engine and hand the outcome to the adapter. This module
must never import a DB driver (import-linter: mcp_server.rules).
"""

from __future__ import annotations

from typing import Annotated

from fastmcp import FastMCP
from pydantic import Field

import rules_core
from mcp_server.envelope import to_json

rule = FastMCP("Rules")


@rule.tool
def check_setbacks(
    setback: Annotated[
        str, Field(description="Which setback: 'front', 'side', or 'rear'.")
    ],
    proposed_ft: Annotated[
        float, Field(description="Proposed setback distance in feet.")
    ],
) -> str:
    """Check a proposed setback against the controlling minimum (local +
    state preemption). Returns the tool-result contract as a JSON string."""
    outcome = rules_core.check_setbacks(
        {"setback": setback, "proposed_ft": proposed_ft}
    )
    # Wire name is `rules_check_setbacks` (mount namespace + underscore separator,
    # ADR-0002). The `tool` field on the contract matches it.
    return to_json("rules_check_setbacks", outcome)
