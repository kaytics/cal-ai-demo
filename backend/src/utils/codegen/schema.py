"""Export the tool-result contract as JSON Schema (camelCase, by_alias)."""

from __future__ import annotations

from typing import Any

from pydantic import TypeAdapter

from utils.contract import ToolResult


def build_json_schema() -> dict[str, Any]:
    """The canonical JSON Schema for the ToolResult union.

    `by_alias=True` so property names are camelCase on the wire, matching the
    generated Zod the web frontend consumes.
    """
    return TypeAdapter(ToolResult).json_schema(by_alias=True)
