# Wayfinder chunks

The full planning document is [`../WAYFINDER_BRIEF.md`](../WAYFINDER_BRIEF.md). It is too big
to chart as one map. This directory splits it into **independent chunks**, each sized to seed its
own `/wayfinder` map so we can nail the decisions down one at a time.

## How to use

Run `/mattpocock-skills:wayfinder` once per chunk, pointing the new map's **Notes** section at the
chunk file (and at the parent brief for shared context). Chunks are mostly independent, but there
is a soft ordering that matches the project's build order and risk profile:

1. **[01 — AG-UI shell & frontend](01-agui-shell-frontend.md)** — chart this first. It contains
   the highest-risk assumption and "the one thing that must survive."
2. **[00 — Platform foundations](00-platform-foundations.md)** — repo/package shape underpins
   every import path in the other chunks.
3. **[02 — Scenario B (rules)](02-scenario-b-rules.md)** — first scenario to build.
4. **[03 — Scenario C (corpus)](03-scenario-c-corpus.md)** — second scenario; unblocks the
   Bedrock/region research the infra chunk also wants.
5. **[04 — Scenario A (parcel)](04-scenario-a-parcel.md)** — third scenario.
6. **[05 — Infra & ops](05-infra-ops.md)** — can run in parallel; a few task tickets gate the demo.

## Important — decisions are revisable

The parent brief marks ~39 decisions as "already closed." **We are treating those as working
assumptions, not law.** Each chunk re-labels them **"Working assumptions (revisable)"**: they are
here as context and as the current best answer, but grilling or research in a chunk's session is
free to overturn any of them. When a session overturns one, record it as a decision on that
chunk's map and note the change back here or in the parent brief.

## Fog coverage

Every Fog item in the parent brief is owned by exactly one chunk — see the table in each chunk's
**Fog** section. Nothing is dropped; nothing is duplicated.
