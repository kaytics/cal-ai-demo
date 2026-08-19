# Chunk 02 — Scenario B: objective standards review (rules engine)

> **For `/wayfinder`.** Point the map's **Notes** at this file and at
> [`../WAYFINDER_BRIEF.md`](../WAYFINDER_BRIEF.md). Working assumptions below are the current best
> answer, **not settled** — grilling and research may overturn any of them.

## Destination

A specified, reviewable deterministic rules core for objective standards review — the first
scenario built (B has no database and no external dependencies) — with the AB 2097 parking
preemption demo and a decided answer for **who legally reviews the rule data** and how.

**Done when:** the rule-data authoring/review model is decided (owner + review artifact), the AB
2097 preemption behaviour is nailed, and the relevant state citations are verified accurate enough
to bake into rule data.

## Working assumptions (revisable)

- Headline demo is **AB 2097 parking preemption** — a local minimum overridden by state law,
  visible in one tool call. (#4)
- Fixture jurisdiction is synthetic **"Demo City"** (`synthetic: true`); **state law citations are
  real and exact**; never fabricate a citation to a real city. (#3)
- **Abstain is first-class** — `insufficient_input` names the exact missing fields; never default,
  infer, or guess. (#7)
- **Fail closed at startup** — malformed rule data or a rule missing a citation throws on load. (#9)
- Every result carries `authority.cite`, `rulesetVersion`, and a `trace` of arithmetic steps. (#10)
- **Preemption is explicit, never silent** — report both numbers plus the preempting authority. (#11)
- Margin convention: minimums → `proposed - required`; maximums → `required - proposed`; negative
  fails; `proposed === required` **passes**. (#13)
- ~35 golden cases for this engine. (brief §Repo shape)

## Out of scope (for this chunk)

- The discriminated-union result type and MCP adapter shape → [chunk 00](00-platform-foundations.md).
- The AG-UI card that renders the verdict → [chunk 01](01-agui-shell-frontend.md).
- Corpus cross-linking (`ruleId`) mechanics → [chunk 03](03-scenario-c-corpus.md).

## Fog — ticket these

| Question | Type |
|---|---|
| **Legal citation verification.** The ADU article was recodified into Gov. Code § 66310 et seq. Confirm whether the SB 9 sections (§ 65852.21, § 66411.7) were touched in the same cleanup before any of it lands in rule data. | `research` |
| **Who legally reviews the rule data**, and what the review artifact looks like. The real cost centre of the project and currently unowned. | `grilling` |

The review-ownership grilling is the load-bearing decision here — it gates trust in every rule.
