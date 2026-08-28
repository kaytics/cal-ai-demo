"""Codegen: utils.contract (Pydantic) -> JSON Schema -> Zod v4 TS source.

Seams under test (confirmed): build_json_schema() and generate_zod(schema).
The runtime "Zod parses real JSON" check is deferred to web/ + vitest (#13).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from utils.codegen import build_json_schema, generate_zod, write_outputs


def test_schema_is_discriminated_on_verdict_camelcase() -> None:
    schema = build_json_schema()
    # Discriminated union on `verdict`; the mapping maps 4 verdict values onto
    # 3 members (pass + fail both -> ComputedResult) — the multi-key case the
    # Zod v4 discriminatedUnion must handle (#11 decision #1).
    assert schema["discriminator"]["propertyName"] == "verdict"
    mapping = schema["discriminator"]["mapping"]
    assert set(mapping) == {"pass", "fail", "answered", "insufficient_input"}
    assert mapping["pass"] == mapping["fail"]  # both point at ComputedResult

    # camelCase on the wire (by_alias): responseMode, not response_mode.
    computed = schema["$defs"]["ComputedResult"]["properties"]
    assert "responseMode" in computed
    assert "response_mode" not in computed


def _norm(ts: str) -> str:
    """Collapse whitespace so assertions are resilient to formatting."""
    return " ".join(ts.split())


def test_leaf_object_is_strict_with_optional_no_null() -> None:
    ts = _norm(generate_zod(build_json_schema()))
    # Authority: required string + string enum + optional url.
    assert "cite: z.string()" in ts
    assert 'kind: z.enum(["statute", "guidance", "local_code"])' in ts
    # #2: optional, NOT nullable — the null branch is stripped.
    assert "url: z.string().optional()" in ts
    assert ".nullable()" not in ts
    # #additionalProperties:false -> strict object.
    assert ".strict()" in ts


def test_discriminant_and_defaulted_fields_are_present_not_optional() -> None:
    ts = _norm(generate_zod(build_json_schema()))
    # A discriminatedUnion needs `verdict` present in every option — never
    # optional, even though Pydantic gives Abstain a default (it is not
    # nullable and the server always stamps it). Same for responseMode.
    assert 'verdict: z.literal("insufficient_input"),' in ts
    assert 'verdict: z.enum(["pass", "fail"]),' in ts
    assert 'verdict: z.literal("answered"),' in ts
    assert 'responseMode: z.literal("ABSTAIN"),' in ts
    assert ".optional()" in ts  # truly-nullable fields (url, preemption) stay optional
    assert 'z.literal("insufficient_input").optional()' not in ts


def _const_bodies(ts: str) -> dict[str, str]:
    """Map each `export const NAME` to the source from its decl to the next."""
    decls = list(re.finditer(r"^export const (\w+) =", ts, re.MULTILINE))
    bodies = {}
    for i, m in enumerate(decls):
        end = decls[i + 1].start() if i + 1 < len(decls) else len(ts)
        bodies[m.group(1)] = ts[m.start() : end]
    return bodies


def test_defs_declared_before_use() -> None:
    # TS `const` has no hoisting — a def referenced before it is declared throws
    # at module load. Emit order must be topological.
    ts = generate_zod(build_json_schema())
    bodies = _const_bodies(ts)
    names = [n for n in bodies if n != "ToolResult"]
    pos = {n: i for i, n in enumerate(names)}
    for name in names:
        for other in names:
            if other != name and re.search(rf"\b{other}\b", bodies[name]):
                assert pos[other] < pos[name], (
                    f"{name} references {other} before it is declared"
                )


def test_write_outputs_emits_schema_and_zod(tmp_path: Path) -> None:
    written = write_outputs(tmp_path)
    schema_file = tmp_path / "tool-result.schema.json"
    zod_file = tmp_path / "tool-result.ts"
    assert set(written) == {schema_file, zod_file}

    schema = json.loads(schema_file.read_text(encoding="utf-8"))
    assert schema["discriminator"]["propertyName"] == "verdict"

    ts = zod_file.read_text(encoding="utf-8")
    assert 'z.discriminatedUnion("verdict"' in ts
    # value union + load-bearing minItems survive into the emitted file.
    assert "value: z.union([z.number(), z.string()])" in ts
    assert ".min(1)" in ts
