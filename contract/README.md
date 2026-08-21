# contract/ — the generated cross-language boundary

Per **ADR-0002 §1** and **ADR-0001**, the tool-result contract is **Pydantic-canonical**
(in `backend/src/contract/`). This directory is a **build output**, not hand-written source:

```
backend Pydantic models
   │  uv run python scripts/export_schema.py
   ▼
tool-result.schema.json        ← committed, reviewable diff surface (the frozen wire boundary)
   │  npm run gen  (json-schema-to-zod)
   ▼
zod/tool-result.ts             ← imported by web/ for after-parse validation
```

**Do not hand-edit** `tool-result.schema.json` or `zod/`. To change the contract, edit the
Pydantic models, re-run the exporter, then `npm run gen`.

> Deferred (map #7): wiring both steps into a single build command / CI check.
