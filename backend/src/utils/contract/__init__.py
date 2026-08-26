"""The tool-result contract — Pydantic canonical models (ADR-0001).

This package is the single source of truth for the result envelope. It is
validated at BOTH ends (mcp_server before send, agui before emit) and is the
source from which `shared/` (top-level) generates JSON Schema -> Zod for the
web frontend.

The model NEVER sets `verdict` or `responseMode`; the mcp_server adapter does.
"""

from utils.contract.models import (
    AbstainResult,
    Authority,
    ComputedResult,
    Preemption,
    ResponseMode,
    SourcedResult,
    ToolResult,
    TraceStep,
    Verdict,
    Version,
    parse_tool_result,
)

__all__ = [
    "AbstainResult",
    "Authority",
    "ComputedResult",
    "Preemption",
    "ResponseMode",
    "SourcedResult",
    "ToolResult",
    "TraceStep",
    "Verdict",
    "Version",
    "parse_tool_result",
]
