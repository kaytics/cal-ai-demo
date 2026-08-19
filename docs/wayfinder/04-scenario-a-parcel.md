# Chunk 04 — Scenario A: pathway eligibility (parcel)

> **For `/wayfinder`.** Point the map's **Notes** at this file and at
> [`../WAYFINDER_BRIEF.md`](../WAYFINDER_BRIEF.md). Working assumptions below are the current best
> answer, **not settled** — grilling and research may overturn any of them.

## Destination

A specified two-stage eligibility flow — an impure site-facts resolver feeding the pure rules core
(a different pack) — with the address→APN geocoding approach decided and the ~8 committed parcel
fixtures scoped.

**Done when:** the geocoding approach and data source for Stage 1 are decided, the `site_facts.json`
fixture set is scoped, and the three-valued eligibility semantics are confirmed against the pack.

## Working assumptions (revisable)

- **Two stages, hard purity boundary.** Stage 1 site-facts resolver is impure (network, GIS);
  Stage 2 eligibility engine is pure — the same rules core with a different pack. (#28)
- `site_facts.json` for ~8 real parcels is **resolved once and committed as fixtures.** Live GIS is
  a stretch goal, never the demo path. (#29)
- Eligibility is **three-valued**: `eligible` / `not_eligible` / `cannot_determine`. Any unresolved
  site fact forces `cannot_determine` for every dependent pathway. **A layer timeout is never a
  "no."** (#30)
- Tenancy and owner-occupancy are **asked, never inferred.** (#31)
- Completeness checking in v1 = generate the checklist deterministically from the pathway
  determination. **No document ingestion.** (#32)
- Multilingual = translate **templates** at authoring time; never translate a citation, a number,
  or a standard name. (#33)

## Out of scope (for this chunk)

- The rules core itself (shared with Scenario B) → [chunk 02](02-scenario-b-rules.md).
- Live GIS resolution as a demo path (stretch goal only).
- Document ingestion / OCR (permanently out of scope, brief §Out of scope).

## Fog — ticket these

| Question | Type |
|---|---|
| **Address → APN geocoding** for Scenario A Stage 1. Approach and data source unknown. | `research` |

This is the only sharp open question for Scenario A; the rest of the chunk is confirming the
working assumptions hold once geocoding is settled.
