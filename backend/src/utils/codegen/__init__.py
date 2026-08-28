"""Build-time codegen: the Pydantic contract -> JSON Schema -> Zod v4 TS.

A dev/build tool, not runtime. Imports `utils.contract` (the source of truth)
and emits the top-level `shared/` boundary consumed by `web/` (ADR-0002 §1
amendment; ADR-0003). Never imported by any `domains.*.core`.
"""

from utils.codegen.schema import build_json_schema
from utils.codegen.writer import write_outputs
from utils.codegen.zod import generate_zod

__all__ = ["build_json_schema", "generate_zod", "write_outputs"]
