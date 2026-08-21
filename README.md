# CA AI Permitting — Showcase Demo

A polyglot demo: a **Python + FastMCP** backend and a **TypeScript (Vite/React)** frontend,
wired over **AG-UI**. The point it shows: *the model never produces a number, verdict, or badge* —
those are server-set fields on a validated tool-result contract, carried on one channel.

Structure and architecture are locked in **[ADR-0002](docs/adr/0002-backend-module-tree-and-shell.md)**
(module tree + shell) and **[ADR-0001](docs/adr/0001-tool-result-contract.md)** (the contract).
Domain language: **[CONTEXT.md](CONTEXT.md)**.

## Layout

Current tree is the **runnable spine** — the rules vertical slice + AG-UI delivery. Web, the
generated contract boundary, and corpus are **deferred** to their chunks (see ADR-0002 §
Implementation status); the full tree still lives in ADR-0002.

```
backend/    one uv project (Python + FastMCP). Flat top-level packages under src/:
              contract/     Pydantic canonical models (ADR-0001)
              rules_core/   PURE engine (no DB/clock/env) — returns a domain outcome
              rules_data/   baked YAML rules
              mcp_server/   FastMCP adapter: domain outcome -> validated ToolResult
              agui/         two-method AG-UI emitter (ag-ui-protocol) + fail-closed gate
              agent/        LLM loop + MCP client (streamable-HTTP)
              shell/        ASGI app: AG-UI SSE endpoint the frontend connects to
fixtures/   golden cases
docs/       CONTEXT.md, adr/, wayfinder/, agents/
```

The MCP call is **real**: `agent` connects to `mcp-server` over streamable-HTTP as an MCP client.
Two processes (`mcp-server` + `shell`) run in one container.

## Run (dev)

```sh
cd backend
uv sync --extra agent
uv run mcp-server            # FastMCP server on :8000  (terminal 1)
uv run shell                 # ASGI shell   on :8080  (terminal 2)

# exercise the AG-UI stream end-to-end:
curl -sN -X POST http://127.0.0.1:8080/agui/run \
  -H 'content-type: application/json' \
  -d '{"tool_name":"rules.check_setbacks","arguments":{"setback":"side","proposed_ft":4}}'
```

## Test & enforce

```sh
cd backend
uv run pytest                # golden cases (rules_core) + contract gate
uv run lint-imports          # rules_core purity + DB-quarantine (ADR-0002 §7)
```

## Status

Scaffold with one working vertical slice (`rules.check_setbacks`, incl. state preemption).
NL planning (Bedrock), `parcel.*`, and `corpus.*` are stubbed for their chunks.
