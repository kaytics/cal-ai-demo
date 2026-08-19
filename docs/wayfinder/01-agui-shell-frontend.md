# Chunk 01 — AG-UI shell & frontend

> **For `/wayfinder`.** Point the map's **Notes** at this file and at
> [`../WAYFINDER_BRIEF.md`](../WAYFINDER_BRIEF.md). Working assumptions below are the current best
> answer, **not settled** — grilling, research, and the prototype may overturn any of them.

## Destination

A validated end-to-end path for the browser layer: the AG-UI channel split proven with one
hardcoded tool result, and a decision on whether we hand-roll the AG-UI emitter/client or adopt a
package (CopilotKit). This is the chunk that protects **"the one thing that must survive"** — a
plain-English question returning a tool-sourced number with citation and version, and an honest
refusal on missing input.

**Done when:** we know (a) whether a bare TypeScript AG-UI server emitter exists or we emit ~5 SSE
event types ourselves, (b) whether the frontend is CopilotKit components or hand-rolled, and (c)
the channel split works in a spike — numbers structurally confined to `TOOL_CALL_RESULT`, prose to
`TEXT_MESSAGE_*`.

## Working assumptions (revisable)

- Two protocols: **MCP** downward, **AG-UI** upward. Nothing proprietary between them. (brief §Shape)
- **Channel split:** numbers travel only on `TOOL_CALL_RESULT` into a structured verdict card;
  prose travels on `TEXT_MESSAGE_*` into a separate pane. (#16)
- **No model in the computation path** — the LLM parses NL into tool args and narrates; never
  produces a number. (#6)
- Every card carries a **response-mode badge**: `COMPUTED` / `SOURCED` / `MIXED` / `ABSTAIN`. (#17)
- **Deterministic mode**: a plain form UI that calls tools directly with no LLM — demo insurance. (#19)
- We're hand-rolling a small Bedrock loop (mature AG-UI adapters target LangGraph/CrewAI/AG2/MAF).

## Out of scope (for this chunk)

- The rules/corpus/parcel tool *implementations* — this chunk uses a hardcoded result. → chunks 02–04.
- Bedrock region/model selection → [chunk 03](03-scenario-c-corpus.md) / [chunk 05](05-infra-ops.md).

## Fog — ticket these

| Question | Type |
|---|---|
| **Does a bare TypeScript AG-UI server emitter package exist?** Or do we emit ~5 event types over SSE ourselves? | `research` |
| **Frontend approach** — CopilotKit React components vs. a hand-rolled AG-UI client, given custom verdict-card and trace-panel needs. | `grilling` |
| **Spike the AG-UI channel split end to end** with one hardcoded tool result, before any rules work — validates the highest-risk assumption. | `prototype` |

Order within the chunk: run the research ticket first (it informs the frontend grilling), then the
prototype validates whichever path is chosen.
