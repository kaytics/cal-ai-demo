"""Emit the tool-result JSON Schema from the canonical Pydantic models into the
top-level contract/ boundary (ADR-0002 §1). Zod is generated from this file on
the web side.

    uv run python scripts/export_schema.py
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import TypeAdapter

from contract import ToolResult

_OUT = Path(__file__).parents[2] / "contract" / "tool-result.schema.json"


def main() -> None:
    schema = TypeAdapter(ToolResult).json_schema(by_alias=True)
    schema["title"] = "ToolResult"
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    _OUT.parent.mkdir(parents=True, exist_ok=True)
    _OUT.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {_OUT}")


if __name__ == "__main__":
    main()
