# Chunk 03 — Scenario C: law & guidance search (corpus + retrieval)

> **For `/wayfinder`.** Point the map's **Notes** at this file and at
> [`../WAYFINDER_BRIEF.md`](../WAYFINDER_BRIEF.md). Working assumptions below are the current best
> answer, **not settled** — grilling and research may overturn any of them.

## Destination

A specified corpus + hybrid-retrieval design over Postgres, with the seed jurisdiction set and the
"comparable" criteria decided, and the Bedrock region/model/embedding/rerank facts pinned down
(region choice depends on this).

**Done when:** we've picked the 5 seed jurisdictions and the `compare_jurisdictions` comparability
criteria, and we know the text model, embedding model + dimension, and rerank availability in the
chosen region.

## Working assumptions (revisable)

- **Ingest is a CLI script run once**, not a service — no Lambda/Step Functions/queues. (#20)
- **Chunk on legal structure** (section/subsection), never token windows; the section number is
  both chunk boundary and citation unit. (#21)
- **Temporal validity is a hard pre-filter**, not a ranking signal — superseded chunks cannot enter
  the candidate pool. (#22)
- Superseded docs **retained and labelled** (`supersededBy` + `sunsetDate`), never deleted. (#23)
- Hybrid retrieval: `tsvector` (GIN) ∥ `pgvector` (HNSW) → RRF; cross-encoder rerank behind a
  feature flag, off by default. (#24)
- Synthesis obeys **authority hierarchy** (statute > guidance > local code) and
  **citation-or-abstain**. (#25)
- Corpus is a **build artifact**: `pg_dump` → S3, tagged; `get_corpus_version` reports the tag. (#26)
- Chunks carry `ruleId` cross-linking into the rules store — powers the cross-scenario demo turn. (#27)
- Pin `embeddingModel` and `dimension` in corpus metadata; startup refuses on mismatch. (#39)
- **Bedrock KBs rejected** — managed chunking/retrieval removes structural chunking + temporal
  pre-filter, the two things this scenario depends on. (#36, #37)
- At most ~5 fixture jurisdictions for corpus. (brief §Out of scope)

## Out of scope (for this chunk)

- RDS provisioning, pgvector install, VPC connector → [chunk 05](05-infra-ops.md).
- The AG-UI `SOURCED`/`MIXED` card rendering → [chunk 01](01-agui-shell-frontend.md).

## Fog — ticket these

| Question | Type |
|---|---|
| **Bedrock model availability in the chosen region** — text model for synthesis, embedding model + dimension options, and whether a rerank API is available. Region choice depends on this. | `research` |
| **Which 5 seed jurisdictions** for the corpus, and the criteria for "comparable" in `corpus.compare_jurisdictions` (population band, region, coastal/inland). | `grilling` |

Cross-link: the Bedrock research also feeds [chunk 05](05-infra-ops.md) (region choice) — whichever
chunk resolves it first should post the finding to both maps.
