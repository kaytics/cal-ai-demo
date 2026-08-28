# ADR-0003 — Domain-oriented backend tree

- **Status:** Accepted
- **Date:** 2026-08-26
- **Deciders:** Bemnet
- **Supersedes in part:** [ADR-0002](0002-backend-module-tree-and-shell.md) §2 (flat top-level
  package tree) and the flat-import rule of §3.
- **Preserves:** ADR-0002 §3 (contract seam — the core is contract-free), §4–§5a (MCP topology,
  two services, underscore tool names), §6 (emitter), and §7 (purity safeguard via import-linter).
  Only the on-disk shape and import paths change.

## Context

ADR-0002 §2 established a **flat** `backend/src/` tree: every package (`contract`, `rules_core`,
`rules_data`, `mcp_server`, `agui`, `agent`, `shell`) sat at the top level and was imported flatly
(`from rules_core import …`). Two problems surfaced as the tree grew:

1. **No home for a domain.** The rules engine is spread across two sibling packages (`rules_core`,
   `rules_data`) with nothing tying them together. ADR-0002 §2 already anticipates `parcel` and
   `corpus` domains, each of which would add two more top-level packages — the root would sprawl.
2. **Top-level names collide with dependencies.** A flat package named `mcp` silently shadowed the
   installed MCP SDK (`import mcp.types`), producing a misleading "FastMCP server support is not
   installed" error. Flat top-level names share a namespace with every installed distribution.

## Decision

### 1. Domain-oriented tree

```
backend/src/
  api/                    ASGI app (AG-UI SSE endpoint) — was shell/
    agent/                LLM loop / MCP client — was top-level agent/
    agui/                 AG-UI emitter — was top-level agui/
  mcp_server/             FastMCP adapter — unchanged
  domains/
    rules/
      core/               pure engine — was rules_core/
      data/               baked YAML — was rules_data/
    # parcel/, corpus/ later — same core/ + data/ shape
  utils/
    contract/             Pydantic canonical models — was contract/
```

Imports become path-qualified: `from domains.rules.core import …`, `from utils.contract import …`,
`from api.agui import …`. `mcp_server` is unchanged and still imports the engine
(`from domains.rules.core import …`).

### 2. A domain is `core/` + `data/`

Each domain owns exactly two subpackages: `core/` (the pure engine) and `data/` (its baked YAML,
read via `importlib.resources`). **A domain's `core/` may import its own `data/` and nothing else** —
not another domain, not the adapter, not the contract. New domains (`parcel`, `corpus`) follow the
same shape and inherit the guarantees below without further wiring.

### 3. Purity is a property of every `core/`, enforced generically

ADR-0002 §7's purity safeguard now targets `domains.*.core` with a wildcard rather than one named
package. Every present and future domain core is forbidden (by import-linter, in CI) from importing
the adapter (`mcp_server`), the transport (`api`), the contract (`utils.contract`), any DB driver,
or any non-deterministic module (clock/env/random). Adding a new domain protects it automatically —
there is no manual linter step to forget.

### 4. Deep nesting removes the shadowing class of bug

Only `api`, `mcp_server`, `domains`, and `utils` remain top-level; none collide with an installed
distribution. Engine/data/contract packages live *under* a namespace (`domains.rules.core`,
`utils.contract`), so they can never shadow a PyPI package the way flat `mcp` did.

### 5. Entry points

Two console scripts remain (ADR-0002 §5). The shell service's entry point is renamed to match its
new package: `api = "api.__main__:main"`; `mcp-server = "mcp_server.__main__:main"` is unchanged.

## Configuration touchpoints

Kept in lockstep so the physical tree, imports, packaging, and lint contracts never drift:

- **`pyproject.toml`** — wheel `packages` = `src/api`, `src/mcp_server`, `src/domains`, `src/utils`;
  `[project.scripts]` `shell` → `api`; `pythonpath = ["src"]` unchanged.
- **`.importlinter`** — `root_packages` = `api`, `mcp_server`, `domains`, `utils`; the purity
  contract's `source_modules` = `domains.*.core`; the no-DB contract targets `domains.rules.core`
  and `mcp_server.rules`.

## Consequences

- Domains are self-contained and discoverable; adding `parcel`/`corpus` is a new folder, not two new
  top-level packages plus linter edits.
- Purity and no-shadowing become structural properties of the layer rather than per-package facts.
- Cost: imports are longer and one-time churn touches every import site plus `pyproject.toml`,
  `.importlinter`, and the tests. The migration is done one package per commit, green-checked
  (`pytest` + `lint-imports` + `ruff`) at each step, so every commit is a working tree.
- ADR-0002's responsibilities, contract seam, MCP topology, and purity *intent* are unchanged — a
  reader still learns the architecture from 0002; 0003 only relocates it.
