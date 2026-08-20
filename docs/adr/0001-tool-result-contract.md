# ADR-0001 — The tool-result contract

- **Status:** Accepted
- **Date:** 2026-08-20
- **Deciders:** wayfinder chunk 01, ticket [#4](https://github.com/kaytics/cal-ai-demo/issues/4)
  (map [#1](https://github.com/kaytics/cal-ai-demo/issues/1))
- **Builds on:** [#2](https://github.com/kaytics/cal-ai-demo/issues/2) (`@ag-ui/*` emitter),
  [#3](https://github.com/kaytics/cal-ai-demo/issues/3) (hand-rolled client + `@ag-ui/client`)

## Context

Every tool (`rules.*`, `parcel.*`, `corpus.*`) returns a structured result that a hand-rolled
verdict card + trace panel + Drawer inspector render. `@ag-ui/encoder` frames it as a `data:`-only
SSE event, and `TOOL_CALL_RESULT.content` is typed `z.string()` — so the result is JSON-stringified
into that one field. The channel split (numbers only on tool-result events, prose only on
`TEXT_MESSAGE_*`) depends on this being the sole path a number travels.

## Decision

**1. One shared result envelope, a discriminated union on `verdict`.** The envelope is identical
across all tools; `verdict` is the discriminant and its allowed values are namespace-specific.

**2. `responseMode` is a separate, server-set field** (`COMPUTED` / `SOURCED` / `MIXED` /
`ABSTAIN`), orthogonal to `verdict`. Both are set server-side (by the tool/adapter, deterministically)
and rendered on the card. The model sets neither.

**3. `trace` is structured steps**, not preformatted strings: `{ label, expression, value }`. The
card renders a table; golden cases assert on individual steps.

**4. One shared Zod schema, validated at both ends.** It lives in a shared package. The server
validates before `JSON.stringify` into `TOOL_CALL_RESULT.content`; the client validates after
`JSON.parse`. A malformed payload is caught at the boundary, not rendered.

## The shape (illustrative TypeScript)

```ts
type ResponseMode = "COMPUTED" | "SOURCED" | "MIXED" | "ABSTAIN";
type Authority = { cite: string; kind: "statute" | "guidance" | "local_code"; url?: string };
type TraceStep = { label: string; expression: string; value: number | string };
type Version = { ruleset?: string; corpus?: string; fixtures?: string; image: string };

interface BaseResult {
  tool: string;                 // "rules.check_parking"
  responseMode: ResponseMode;   // server-set badge
  version: Version;             // provenance, always present
  authority?: Authority[];      // citations backing the result
  timestamp: string;
}

// discriminated on `verdict`
type Abstain  = BaseResult & { verdict: "insufficient_input"; responseMode: "ABSTAIN"; missing: string[] };
type Computed = BaseResult & {
  verdict: "pass" | "fail";
  proposed: number; required: number; margin: number;   // margin convention in CONTEXT.md
  trace: TraceStep[];
  preemption?: {                                         // present only when a local rule is overridden
    local:       { value: number; authority: Authority };
    controlling: { value: number; authority: Authority };
    note: string;
  };
};
type Sourced  = BaseResult & { verdict: "answered"; answer: string; citations: Authority[] };

type ToolResult = Abstain | Computed | Sourced /* | parcel eligibility members — chunk 04 */;
```

`Abstain` is universal (every tool can refuse). `Computed`/`Sourced` are the rules/corpus members;
`parcel.*` eligibility members (`eligible` / `not_eligible` / `cannot_determine`) are added in
chunk 04 without changing the envelope.

## Consequences

- The verdict card renders entirely from a parsed, validated `ToolResult`; the badge is
  `responseMode`; the trace panel renders `trace[]`; the inspector shows the raw stringified payload.
- "The model never produces a number/verdict/badge" holds structurally — all three are server-set
  fields on the one stringified channel.
- Per-tool verdict members extend the union without touching the shared envelope, so chunks 02–04
  add their members independently.
- Cost: a shared schema package both server and client depend on (fits the monorepo shape, chunk 00).

## Open / deferred

- Exact per-namespace `verdict` enumerations for `rules.*`, `corpus.*`, `parcel.*` — their chunks.
- Whether `authority.url` resolves to a real source viewer — out of scope for the demo.
