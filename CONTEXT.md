# CONTEXT — CA AI Permitting Showcase Demo

The ubiquitous language for this project. Skills and contributors should use these terms exactly;
if a concept you need isn't here, that's a signal to add it (via `/domain-modeling`) rather than
drift to a synonym.

> Seeded from wayfinder chunk 01 (map [#1](https://github.com/kaytics/cal-ai-demo/issues/1)),
> ticket [#4](https://github.com/kaytics/cal-ai-demo/issues/4) — the tool-result contract. It will
> grow as later chunks resolve. See `docs/adr/` for the decisions behind these terms.

## Agent loop terms

- **Planner** — the LLM step that turns a natural-language `message` into a **tool plan**: which MCP
  tool to call and the arguments to call it with. Uses native tool-calling over the MCP tool surface
  discovered dynamically (`list_tools`), with `tool_choice: auto`. It **never fabricates an argument
  value** to satisfy a schema — an argument it can't extract from the message is left unset, so the
  tool's own ABSTAIN fires (see [[#abstain]]). It may also select **no tool** (out of scope), which
  yields a prose-only turn.
- **Narrator** — the LLM step that runs **after** the tool call and writes the post-call prose
  ("outro") narrating the result. It is grounded on the **full tool result including `trace`** and
  streams token-by-token into the prose channel. It reads/explains numbers the tool produced; it
  never computes (the computation invariant). Constrained by a strict system prompt, no wiring guard.
- **Prose-only turn** — a turn that emits `RUN_STARTED → TEXT_MESSAGE_* → RUN_FINISHED` with **no**
  tool-call frames and **no** card. The single shape for both (a) an out-of-scope planner *decline*
  and (b) a *planner failure* (graceful apology). A **narrator** failure is different: the card has
  already streamed, so the turn just drops the outro and still finishes cleanly.
- **Ask** — the natural-language entry path (`POST /agui/run` with `{message}`). The land-permit
  **Form** (structured, no-LLM application flow) is a *separate application* (Scenario A), not a mode
  of this endpoint.

## Core terms

- **Tool result** — the single structured value every tool returns. Serialized to a JSON **string**
  and carried on exactly one AG-UI channel: `TOOL_CALL_RESULT.content` (which is `z.string()`).
  This is the sole channel the *structured* result (verdict, margin, trace, versions) travels on;
  the card renders from it.
- **Computation invariant** — the guarantee the demo exists to show: **the model never performs
  computation.** All arithmetic and rule application happen in a pure, deterministic, testable MCP
  tool; `verdict` / `responseMode` / `trace` are **server-set** and the model sets none of them.
  The model is a *reader and explainer* of the tool result, never a calculator. It follows that the
  agent's prose *may* voice numbers it read from the tool result and explain the convention behind
  them (needed to answer follow-ups like "why is the requirement 0?") — this does **not** violate the
  invariant, because the number was computed by the tool, not originated by the model. Enforced for
  now by a **strict system prompt** (grounded narration over the full result + trace), not a wiring
  guard. Supersedes the earlier, over-strong "no number ever travels in prose" phrasing. See ADR-0001
  and its amendment.
- **Verdict** — the domain outcome of a tool call, and the **discriminant** of the result union.
  Values are namespace-specific (`rules.*` → `pass` / `fail` / `insufficient_input`; `parcel.*` →
  `eligible` / `not_eligible` / `cannot_determine` / `insufficient_input`; `corpus.*` → `answered` /
  `insufficient_input`). The model never sets it.
- **Response mode** — a *separate*, server-set badge describing **where the answer came from**:
  `COMPUTED` (arithmetic only), `SOURCED` (law/guidance citation only), `MIXED` (both), `ABSTAIN`
  (a refusal). Orthogonal to verdict; both are rendered on the card. The model never sets it.
- **Abstain** — the first-class refusal. `verdict: "insufficient_input"`, `responseMode: "ABSTAIN"`,
  and a **`missing`** list naming the exact fields required to answer. Never default, infer, or guess.
- **Authority** — a citation backing a claim: `{ cite, kind: "statute" | "guidance" | "local_code",
  url? }`. State-law cites are real and exact; local (Demo City) is synthetic.
- **Trace** — the arithmetic proof of a computed result: an ordered list of **trace steps**, each
  `{ label, expression, value }`. Structured (not prose) so golden cases can assert on each step.
- **Margin** — for a computed pass/fail: minimums → `proposed − required`; maximums →
  `required − proposed`. Negative fails; `proposed === required` **passes**.
- **Preemption** — when a state authority overrides a local minimum, both numbers are reported plus
  the controlling authority. Never silent. See the `preemption` field in ADR-0001.
- **Version** — provenance stamped on every result: `rulesetVersion` / `corpusVersion` /
  `fixturesVersion` as applicable, plus the container `image` tag. Structurally tied to the image.
