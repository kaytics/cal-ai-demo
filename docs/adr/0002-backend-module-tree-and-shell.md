# ADR-0002 — Backend module tree & shell architecture (polyglot pivot)

- **Status:** Accepted
- **Date:** 2026-08-21
- **Deciders:** wayfinder chunk 00, ticket [#9](https://github.com/kaytics/cal-ai-demo/issues/9)
  (map [#7](https://github.com/kaytics/cal-ai-demo/issues/7))
- **Builds on:** [#8](https://github.com/kaytics/cal-ai-demo/issues/8) (Python AG-UI emitter research),
  [ADR-0001](0001-tool-result-contract.md) (the tool-result contract)
- **Supersedes in part:** `docs/wayfinder/00-platform-foundations.md` (written all-TypeScript) and
  chunk-01 decisions [#2](https://github.com/kaytics/cal-ai-demo/issues/2) (TS `@ag-ui/*` emitter)
  and [#4](https://github.com/kaytics/cal-ai-demo/issues/4) (single shared *Zod* schema).

## Implementation status

The decision below stands in full. The **on-disk tree is deliberately a subset** while we
iterate the rules engine first — deferred, not reversed:

- **Present (runnable spine):** `contract`, `rules_core`, `rules_data`, `mcp_server`, `agui`,
  `agent`, `shell` + golden tests. The rules vertical slice runs end-to-end over real MCP.
- **Deferred:** `web/` (frontend chunk), the generated `contract/` boundary + its exporter (returns
  with `web/`), and `corpus_ingest` / `corpus_query` (chunk C). Rebuild from this ADR when their
  chunks start.

## Context

The stack is now **polyglot**: a **Python + FastMCP** backend and a **TypeScript (Vite/React)**
frontend. AG-UI is emitted from Python. This ADR locks the repo's top-level shape, the `backend/`
internal module tree, the process topology, and the rules-core → adapter → shell relationship —
concretely enough that `/to-spec` can scaffold it.

## Decision

### 1. Top-level (polyglot) shape
```
backend/    one uv project (Python + FastMCP)
web/        npm (Vite/React SPA)
contract/   GENERATED boundary: JSON Schema (from Pydantic) + generated Zod, consumed by web/
fixtures/   site-facts + golden cases
docs/       CONTEXT.md, adr/, wayfinder/, agents/
```
Python and TS never share a workspace manager. `backend/` is **one uv project with flat top-level
internal packages** (not a uv workspace); `web/` is npm.

### 2. `backend/src/` module tree (flat top-level packages)
`contract/` (Pydantic canonical), `rules_core/` (pure engine), `rules_data/` (baked YAML),
`corpus_ingest/` (offline CLI), `corpus_query/` (DB-backed retrieval, owns the DB pool),
`mcp_server/` (FastMCP adapter), `agui/` (emitter), `agent/` (LLM loop / MCP client), `shell/`
(ASGI app). Imports are flat: `from rules_core import …`, `from contract import …`.

### 3. Contract seam — the pure core is contract-free
`rules_core` returns a **pure domain result** (verdict, proposed/required/margin, trace, preemption)
and imports **nothing** — not even `contract`. The **`mcp_server` adapter** maps the domain result
into the `ToolResult` envelope: it stamps `timestamp` and `version`, sets the `responseMode` badge
and `tool` name, and validates against the Pydantic contract before returning. This is the only
placement consistent with rules-core purity (no clock/env) and ADR-0001's "the adapter sets the badge."

### 4. MCP is real in the request path
The `agent` is a genuine **MCP client** that calls the FastMCP server over **streamable-HTTP**. The
tool call crosses the MCP wire — the demo exercises MCP end-to-end rather than faking it in-process.

### 5. Process topology — two services, one container
- **`mcp-server`** (ASGI, own port): imports `rules_core`, `rules_data`, `corpus_query`, `contract`.
- **`shell`** (ASGI, AG-UI SSE endpoint the frontend connects to): runs `agent` + `agui`, imports
  `contract`. `agent` connects to `mcp-server` as an HTTP MCP client.

Two console-script entry points; the container runs both.

### 5a. Tool wire names — underscore, via mounted sub-servers

Each namespace is its own `FastMCP` sub-server (`rules = FastMCP("Rules")`) mounted onto the root
with a namespace prefix (`app.mount(rule, namespace="rules")`). FastMCP joins the prefix to the tool
name with an **underscore**, so the wire name is **`rules_check_setbacks`**, not the dotted
`rules.check_setbacks`. This keeps foundations #15's intent (tool names are always namespaced, never
flat) — only the separator glyph differs, and it is fixed by FastMCP's mount, not chosen. The
contract's `tool` field is stamped to match the wire name. Callers (shell request body, agent,
future frontend) use the underscore form.

### 6. Emitter
Use the library **`ag-ui-protocol`** (pin `0.1.20`), wrapped in a project-owned two-method emitter:
`emit_verdict` → `TOOL_CALL_RESULT` only; `emit_prose` → `TEXT_MESSAGE_*` only. The encoder does not
validate, so `agui` runs a **Pydantic fail-closed gate** on the structured payload before serializing
it into `content`. Contract is thus validated at **both ends** (mcp-server on produce, agui on receive).

### 7. Purity safeguard under a single server (overrides foundations #18 at the process level)
The user chose **one** FastMCP server for all namespaces (`rules.*`, `parcel.*`, `corpus.*`) rather
than a per-engine split. To preserve the intent of foundations constraint #18 ("rules engine never
acquires a DB dependency; separate health checks; no shared pool") within one process:
- **`rules_core`/`parcel` import zero DB drivers** — enforced by **import-linter** in CI.
- The **DB pool is quarantined in `corpus_query`**; rules/parcel handlers never touch it.
- "Separate health checks" becomes **per-namespace health** within the one server.

## Consequences

- `rules_core` is trivially unit-testable and AI-navigable — no transport, no I/O beyond baked YAML,
  no contract dependency. Golden cases (~35/engine) assert on the domain result directly.
- The MCP boundary is demonstrable (curl-able HTTP server), matching the demo's "AI + MCP" point.
- Cost: two long-running services to orchestrate in one container; two-sided contract validation;
  import-linter rules to keep rules-core pure now that it shares a process with the DB-backed corpus.
- `contract/` (top-level) is a build output: Pydantic → JSON Schema → generated Zod for `web/`.

## Open / deferred (to the scaffolding session)

- How the Pydantic → JSON Schema → Zod generator is wired into the build (owner, when it runs).
- Container process manager for running `mcp-server` + `shell` together (chunk 05 / infra).
