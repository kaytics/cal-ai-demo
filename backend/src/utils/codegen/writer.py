"""Write the generated boundary files into a destination directory."""

from __future__ import annotations

import json
from pathlib import Path

from utils.codegen.schema import build_json_schema
from utils.codegen.zod import generate_zod

SCHEMA_FILE = "tool-result.schema.json"
ZOD_FILE = "tool-result.ts"


def write_outputs(dest: Path) -> list[Path]:
    """Emit the JSON Schema + Zod TS into `dest`, returning the files written."""
    dest.mkdir(parents=True, exist_ok=True)
    schema = build_json_schema()

    schema_path = dest / SCHEMA_FILE
    schema_path.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")

    zod_path = dest / ZOD_FILE
    zod_path.write_text(generate_zod(schema), encoding="utf-8")

    return [schema_path, zod_path]
