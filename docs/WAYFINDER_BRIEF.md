# Project Brief — CA AI Permitting Showcase Demo

> **For `/wayfinder`.** Point the map's **Notes** section at this file. Everything under
> **Decisions already closed** is settled — do not open grilling tickets for it. Ticket only
> what's listed under **Fog**.

---

## Destination

A single deployed web app that demonstrates AI-assisted housing permitting across three
scenarios from California's AI Permitting Innovation Showcase, built so that every number it
shows is provably computed and every claim it makes is provably sourced.

**Done when:** a judge opens one URL, asks four questions in plain English, and sees each answer
labelled with where it came from — arithmetic or law — with citations and a pinned version on
every card. Plus a CI number we can quote in the written submission.

Not a product. Not integrated with anything. A capability demo.

---

## Shape

**One app. Two engines. Three tool namespaces.**

| Namespace | Scenario | Engine | Guarantee |
|---|---|---|---|
| `rules.*` | B — objective standards review | Deterministic rules core | Byte-identical output for identical input |
| `parcel.*` | A — pathway eligibility | Same rules core + site-facts resolver | Same, over cached fixtures |
| `corpus.*` | C — law & guidance search | Hybrid retrieval over Postgres | Reproducible retrieval; every sentence cited |

Two protocols: **MCP** downward to tools, **AG-UI** upward to the browser. Nothing proprietary
between them — this is a talking point for the submission, not just plumbing.

---

## Decisions already closed

Do not re-open these. If one turns out wrong, raise it explicitly rather than designing around it.

### Product scope
1. Standalone demo — **no** integration with Accela, Tyler EnerGov, OpenGov, or Clariti.
2. Build order: **Scenario B → C → A.** B has no database and no external dependencies.
3. Fixture jurisdiction is synthetic, named **"Demo City"**, flagged `synthetic: true`.
   **State law citations are real and exact.** Never fabricate a citation to a real city.
4. Scenario B's headline demo is **AB 2097 parking preemption** — a local minimum overridden by
   state law, visible in one tool call.

### Core architecture
5. The rules core is a **pure library**. MCP is an adapter over it, not the app.
6. **No model in the computation path.** The LLM parses natural language into tool arguments and
   narrates results. It never produces a number.
7. **Abstain is a first-class verdict.** `insufficient_input` names the exact missing fields.
   Never default, never infer, never guess.
8. Rules are **data, not code** — YAML, baked into the container image. `rulesetVersion` is
   structurally tied to the image tag.
9. **Fail closed at startup.** Malformed rule data or a rule missing a citation throws on load.
10. Every result carries `authority.cite`, `rulesetVersion`, and a `trace` of arithmetic steps.
11. **Preemption is explicit, never silent** — report both numbers plus the preempting authority.
12. Result type is a **discriminated union on `verdict`**, identical across all tools.
13. Margin convention: minimums → `proposed - required`; maximums → `required - proposed`.
    Negative fails. `proposed === required` **passes**.

### The unified shell
14. One container hosts the shared shell; engines stay separate below it.
15. **Namespaced tool names** (`rules.check_setbacks`, not `check_setbacks`) — flat namespaces
    degrade tool selection.
16. **Channel split in AG-UI:** numbers travel only on `TOOL_CALL_RESULT` events into a
    structured verdict card; prose travels on `TEXT_MESSAGE_*` into a separate pane. This makes
    "the model never produces a number" a property of the wiring, not a policy.
17. Every card carries a **response-mode badge**: `COMPUTED` / `SOURCED` / `MIXED` / `ABSTAIN`.
18. **The rules engine must never acquire a database dependency.** If RDS is down, `rules.*` and
    `parcel.*` keep answering; `corpus.*` degrades to a clear unavailable state. Separate health
    checks, no shared pool.
19. **Deterministic mode**: a plain form UI that calls tools directly with no LLM. Demo insurance
    and the fastest manual test surface.

### Scenario C specifics
20. **Ingest is a CLI script run once, not a service.** No Lambda, no Step Functions, no queues.
21. **Chunk on legal structure** (section/subsection), never token windows. The section number is
    both the chunk boundary and the citation unit.
22. **Temporal validity is a hard pre-filter, not a ranking signal.** Superseded chunks must be
    structurally unable to enter the candidate pool.
23. Superseded documents are **retained and labelled**, never deleted. `supersededBy` + `sunsetDate`.
24. Hybrid retrieval: `tsvector` (GIN) ∥ `pgvector` (HNSW) → RRF. Cross-encoder rerank behind a
    feature flag, off by default.
25. Synthesis obeys **authority hierarchy** (statute > guidance > local code) and
    **citation-or-abstain**.
26. Corpus is a **build artifact**: `pg_dump` → S3, tagged. `get_corpus_version` reports the tag.
27. Chunks carry `ruleId` cross-linking into the rules store — this is what makes the
    cross-scenario demo turn work.

### Scenario A specifics
28. **Two stages with a hard purity boundary.** Stage 1 site-facts resolver is impure (network,
    GIS). Stage 2 eligibility engine is pure and is the same rules core with a different pack.
29. `site_facts.json` for ~8 real parcels is **resolved once and committed as fixtures.** Live
    GIS resolution is a stretch goal, never the demo path.
30. Eligibility is **three-valued**: `eligible` / `not_eligible` / `cannot_determine`. Any
    unresolved site fact forces `cannot_determine` for every dependent pathway. **A layer timeout
    is never a "no."**
31. Tenancy and owner-occupancy are **asked, never inferred.**
32. Completeness checking in v1 = generate the checklist deterministically from the pathway
    determination. **No document ingestion.**
33. Multilingual = translate **templates** at authoring time. Never translate a citation, a
    number, or a standard name.

### Stack & infra
34. TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), no `any`,
    no `!` outside tests. `fastmcp` + `zod` + `vitest` + `yaml`.
35. AWS, minimum viable set: **ECR, App Runner, RDS Postgres `db.t4g.micro` + pgvector, Bedrock,
    S3, SSM Parameter Store, CloudWatch Logs.**
36. **Rejected:** OpenSearch Serverless, Kendra, Bedrock Knowledge Bases, Aurora Serverless,
    SageMaker, API Gateway + Lambda, Textract, Comprehend, Translate, Location Service, Cognito,
    WAF, CloudFront, GovCloud. Each was considered; each is cost or complexity without demo value.
37. Bedrock Knowledge Bases specifically rejected because managed chunking and retrieval removes
    the two things Scenario C depends on: structural chunking and temporal pre-filtering.
38. **App Runner needs a VPC Connector to reach RDS.** Do not make RDS publicly accessible —
    App Runner egress IPs aren't static. This is the only non-trivial AWS plumbing in the project.
39. Pin `embeddingModel` and `dimension` in corpus metadata; startup refuses to serve on mismatch.

---

## Out of scope

Ruled beyond the destination. Never graduates out of this list.

- Integration with any existing permit system
- Authentication, authorization, multi-tenancy, rate limiting
- Plan-set OCR, vision, or any document ingestion
- Energy code compliance (COMcheck / REScheck), lighting power density, gbXML, BIM
- GAN and PINN architectures — wrong tools for these tasks
- Discretionary judgment of any kind (neighborhood character, design review)
- Live legislative monitoring on a schedule
- More than one fixture jurisdiction for rules; more than ~5 for corpus
- Production compliance posture — SOC 2, GovCloud, formal SAM 5300 control mapping
- Connection pooling, read replicas, Multi-AZ, caching layers, incremental ingest
- Mobile app, native app, offline mode
- Real applicant PII anywhere in the system

---

## Fog — not yet specified

These are the real open questions. **Ticket these.**

### Research (`wayfinder:research`)
- **Does a bare TypeScript AG-UI server emitter package exist?** Mature adapters target
  LangGraph, CrewAI, AG2, Microsoft Agent Framework. We're hand-rolling a small Bedrock loop.
  Confirm whether we emit ~5 event types over SSE ourselves or adopt a package.
- **Bedrock model availability in the chosen region** — text model for synthesis, embedding model
  and its dimension options, and whether a rerank API is available. Region choice depends on this.
- **Legal citation verification.** The ADU article was recodified into Gov. Code § 66310 et seq.
  Confirm whether the SB 9 sections (§ 65852.21, § 66411.7) were touched in the same cleanup
  before any of it lands in rule data.
- **Address → APN geocoding** for Scenario A Stage 1. Approach and data source unknown.

### Grilling (`wayfinder:grilling`)
- **Monorepo shape** — pnpm workspaces with separate packages for core / mcp / web / ingest, vs.
  one package with directories. Affects every import path.
- **Frontend approach** — CopilotKit React components vs. a hand-rolled AG-UI client. The custom
  verdict-card and trace-panel requirements may fight opinionated components.
- **Which 5 seed jurisdictions** for the corpus, and the criteria for "comparable" in
  `corpus.compare_jurisdictions` (population band, region, coastal/inland).
- **Who legally reviews the rule data**, and what the review artifact looks like. This is the real
  cost centre of the project and currently unowned.
- **Audit log schema** for the PRA-retrievable bundle — what fields, what retention, what export
  format.

### Task (`wayfinder:task`)
- AWS account access, who provisions, whether the demo runs always-on or paused between sessions.
- Demo script ownership and rehearsal schedule.

### Prototype (`wayfinder:prototype`)
- Spike the AG-UI channel split end to end with one hardcoded tool result, before any rules work.
  This validates the highest-risk assumption in the design (that numbers can be structurally
  confined to tool-result events).

---

## Repo shape (proposed, not locked — see Fog)

```
packages/
  rules-core/        # pure. no network, no clock, no randomness
  rules-data/        # demo-city.yaml, state-rules.yaml, parcel packs
  mcp-server/        # tool defs, zod schemas, stdio + HTTP transports
  agent/             # Bedrock loop + AG-UI event emitter
  web/               # AG-UI client, verdict cards, trace panel, deterministic mode
  corpus-ingest/     # the offline CLI
  corpus-query/      # hybrid SQL + RRF + temporal filter
fixtures/
  site-facts/        # ~8 committed parcels
  golden/            # ~35 cases per engine
docs/
  AGENTS.md          # scenario specs (already written)
```

---

## Workflow

<cite index="8-1">Wayfinder hands off; it does not build. When the map clears, merge onto `/to-spec`, which
collapses the map's linked decisions into a buildable plan</cite> — then `/to-tickets` and `/implement`.

Two practical notes:
- Run `/setup-matt-pocock-skills` first so the tracker wiring exists; otherwise the map falls
  back to local markdown files.
- <cite index="10-1">The grilling verbosity is a known, unresolved complaint. Mitigations in circulation: run a
  lower reasoning effort, and put a plain-language instruction in the global CLAUDE.md.</cite>
  With ~39 decisions pre-closed above, the map should be small.

---

## The one thing that must survive

If the schedule collapses and only one thing ships, it is this: **a planner asks a question in
plain English, gets a number that came from a tool, sees the code citation and the ruleset
version, asks a second question with a missing input, and gets an honest refusal instead of a
guess.**

That sequence is the entire pitch. Everything else is expansion.
