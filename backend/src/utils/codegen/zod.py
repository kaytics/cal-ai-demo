"""JSON Schema -> Zod v4 TypeScript source.

Targets Zod v4 (#11 decision #1): a single `z.discriminatedUnion` whose options
may carry an enum discriminant. Optionals drop the null branch and become
`.optional()` (#11 decision #2); `additionalProperties:false` -> `.strict()`.
"""

from __future__ import annotations

from typing import Any

_NULL = {"type": "null"}


def _ref_name(ref: str) -> str:
    """`#/$defs/_PreemptionSide` -> `PreemptionSide` (drop path + leading _)."""
    return ref.rsplit("/", 1)[-1].lstrip("_")


def _is_nullable(node: dict[str, Any]) -> bool:
    """True if the property admits `null` (an `X | None` field)."""
    return _NULL in node.get("anyOf", [])


def _strip_null(node: dict[str, Any]) -> dict[str, Any]:
    """Remove the `null` branch from an anyOf, collapsing a lone survivor."""
    if "anyOf" not in node:
        return node
    rest = [b for b in node["anyOf"] if b != _NULL]
    return rest[0] if len(rest) == 1 else {**node, "anyOf": rest}


def _zod_for(node: dict[str, Any]) -> str:
    if "$ref" in node:
        return _ref_name(node["$ref"])
    if "const" in node:
        return f'z.literal("{node["const"]}")'
    if "enum" in node:
        members = ", ".join(f'"{v}"' for v in node["enum"])
        return f"z.enum([{members}])"
    if "anyOf" in node:
        parts = [_zod_for(b) for b in node["anyOf"] if b != _NULL]
        return parts[0] if len(parts) == 1 else f"z.union([{', '.join(parts)}])"
    typ = node.get("type")
    if typ == "string":
        return "z.string()"
    if typ in ("number", "integer"):
        return "z.number()"
    if typ == "boolean":
        return "z.boolean()"
    if typ == "array":
        item = _zod_for(node["items"])
        arr = f"z.array({item})"
        return arr + f".min({node['minItems']})" if "minItems" in node else arr
    if typ == "object":
        return _zod_object(node)
    raise ValueError(f"unmapped schema node: {node!r}")


def _zod_object(defn: dict[str, Any]) -> str:
    lines = []
    for key, prop in defn.get("properties", {}).items():
        val = _zod_for(_strip_null(prop))
        # Optional iff nullable (an X | None field the server omits on the wire),
        # NOT merely absent from `required` — a defaulted-but-non-nullable field
        # (verdict, responseMode) is always stamped and must stay present so the
        # discriminatedUnion works (#11 decision #2).
        if _is_nullable(prop):
            val += ".optional()"
        lines.append(f"  {key}: {val},")
    body = "\n".join(lines)
    return f"z.object({{\n{body}\n}}).strict()"


def _refs_in(node: Any) -> set[str]:
    """Every def name referenced (transitively) inside a schema node."""
    if isinstance(node, dict):
        found = {_ref_name(node["$ref"])} if "$ref" in node else set()
        return found.union(*(_refs_in(v) for v in node.values()))
    if isinstance(node, list):
        return set().union(*(_refs_in(v) for v in node)) if node else set()
    return set()


def _topological(defs: dict[str, Any]) -> list[str]:
    """Order def names so each is declared after everything it references
    (TS `const` has no hoisting). Deterministic: ties broken by name."""
    by_name = {_ref_name("#/" + n): n for n in defs}
    ordered: list[str] = []
    seen: set[str] = set()

    def visit(name: str) -> None:
        if name in seen:
            return
        seen.add(name)
        for dep in sorted(_refs_in(defs[by_name[name]])):
            if dep in by_name:
                visit(dep)
        ordered.append(name)

    for name in sorted(by_name):
        visit(name)
    return [by_name[n] for n in ordered]


def generate_zod(schema: dict[str, Any]) -> str:
    defs = schema.get("$defs", {})
    blocks = [
        "// GENERATED - do not edit. Source: utils.contract (uv run export-schema).",
        'import { z } from "zod";',
        "",
    ]
    for name in _topological(defs):
        blocks.append(f"export const {_ref_name('#/' + name)} = {_zod_for(defs[name])};")

    options = ", ".join(_ref_name(m["$ref"]) for m in schema["oneOf"])
    prop = schema["discriminator"]["propertyName"]
    blocks.append("")
    blocks.append(
        f'export const ToolResult = z.discriminatedUnion("{prop}", [{options}]);'
    )
    blocks.append("export type ToolResult = z.infer<typeof ToolResult>;")
    return "\n".join(blocks) + "\n"
