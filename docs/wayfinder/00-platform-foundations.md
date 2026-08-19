# Chunk 00 — Platform foundations

> **For `/wayfinder`.** Point the map's **Notes** at this file and at
> [`../WAYFINDER_BRIEF.md`](../WAYFINDER_BRIEF.md). Working assumptions below are the current best
> answer, **not settled** — grilling may overturn any of them.

## Destination

A locked repo/package structure and a locked "shared shell" architecture that the three scenario
chunks and the infra chunk can all build against without renegotiating import paths or process
boundaries.

**Done when:** the monorepo shape is decided (workspaces vs. one package with directories), the
package boundaries are named, and the rules-core → MCP-adapter → shell relationship is drawn
concretely enough that `/to-spec` could scaffold it.

## Working assumptions (revisable)

From the parent brief — carried in as context, overturnable in grilling:

- The rules core is a **pure library**; MCP is an adapter over it, not the app. (#5)
- Rules are **data, not code** — YAML baked into the image; `rulesetVersion` tied to the image tag. (#8, #34)
- **Namespaced tool names** (`rules.check_setbacks`), never flat. (#15)
- One container hosts the **shared shell**; engines stay separate below it. (#14)
- The rules engine **must never acquire a database dependency** — separate health checks, no
  shared pool. (#18)
- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), no `any`, no `!`
  outside tests. `fastmcp` + `zod` + `vitest` + `yaml`. (#34)
- Result type is a **discriminated union on `verdict`**, identical across all tools. (#12)
- Proposed repo shape (packages `rules-core`, `rules-data`, `mcp-server`, `agent`, `web`,
  `corpus-ingest`, `corpus-query`; `fixtures/`, `docs/`) — **proposed, not locked.**

## Out of scope (for this chunk)

- The AG-UI event wiring itself → [chunk 01](01-agui-shell-frontend.md).
- Anything scenario-specific → chunks 02–04.
- AWS/deployment topology → [chunk 05](05-infra-ops.md).

## Fog — ticket these

| Question | Type |
|---|---|
| **Monorepo shape** — pnpm workspaces with separate packages for core / mcp / web / ingest, vs. one package with directories. Affects every import path. | `grilling` |

Blocking note: this chunk's outcome is a soft prerequisite for the scenario chunks (import paths),
but they can proceed on the proposed shape and adjust.
