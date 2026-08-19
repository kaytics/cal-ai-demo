# Chunk 05 — Infra, deployment & ops

> **For `/wayfinder`.** Point the map's **Notes** at this file and at
> [`../WAYFINDER_BRIEF.md`](../WAYFINDER_BRIEF.md). Working assumptions below are the current best
> answer, **not settled** — grilling and tasks may overturn any of them.

## Destination

A deployable AWS topology and an owned operational plan: account access provisioned, the demo's
run posture decided (always-on vs. paused), the demo script owned and rehearsed, and the
PRA-retrievable audit-log schema specified.

**Done when:** someone owns AWS provisioning and the demo runs from a known account; the App
Runner↔RDS plumbing is drawn; the audit-log bundle schema is decided; and the demo script has an
owner and a rehearsal slot.

## Working assumptions (revisable)

- AWS minimum set: **ECR, App Runner, RDS Postgres `db.t4g.micro` + pgvector, Bedrock, S3, SSM
  Parameter Store, CloudWatch Logs.** (#35)
- **Rejected:** OpenSearch Serverless, Kendra, Bedrock KBs, Aurora Serverless, SageMaker, API
  Gateway + Lambda, Textract, Comprehend, Translate, Location Service, Cognito, WAF, CloudFront,
  GovCloud. (#36)
- **App Runner needs a VPC Connector to reach RDS.** RDS **not** publicly accessible (App Runner
  egress IPs aren't static). The only non-trivial AWS plumbing in the project. (#38)
- Separate health checks per engine; `corpus.*` degrades to a clear unavailable state if RDS is
  down; `rules.*`/`parcel.*` keep answering. (#18)
- No connection pooling, read replicas, Multi-AZ, caching, or incremental ingest. (brief §Out of scope)
- No auth/authz, no real applicant PII anywhere. (brief §Out of scope)

## Out of scope (for this chunk)

- Retrieval/ingest logic that runs on this infra → [chunk 03](03-scenario-c-corpus.md).
- Production compliance posture — SOC 2, GovCloud, SAM 5300 control mapping (permanently out).

## Fog — ticket these

| Question | Type |
|---|---|
| **AWS account access** — who provisions, and whether the demo runs always-on or paused between sessions. | `task` |
| **Demo script ownership and rehearsal schedule.** | `task` |
| **Audit log schema** for the PRA-retrievable bundle — what fields, what retention, what export format. | `grilling` |

Cross-link: the Bedrock **region** decision is researched in
[chunk 03](03-scenario-c-corpus.md); this chunk consumes its outcome for region selection.
