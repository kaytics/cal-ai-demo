# CONTEXT — CA AI Permitting Showcase Demo

The ubiquitous language for this project. Skills and contributors should use these terms exactly;
if a concept you need isn't here, that's a signal to add it (via `/domain-modeling`) rather than
drift to a synonym.

> Seeded from wayfinder chunk 01 (map [#1](https://github.com/kaytics/cal-ai-demo/issues/1)),
> ticket [#4](https://github.com/kaytics/cal-ai-demo/issues/4) — the tool-result contract. It will
> grow as later chunks resolve. See `docs/adr/` for the decisions behind these terms.

## Core terms

- **Tool result** — the single structured value every tool returns. Serialized to a JSON **string**
  and carried on exactly one AG-UI channel: `TOOL_CALL_RESULT.content` (which is `z.string()`).
  Never travels in prose. This is what makes "the model never produces a number" a property of the
  wiring. See ADR-0001.
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
