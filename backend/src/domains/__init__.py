"""Business domains (ADR-0003 §1–§2).

Each domain owns a `core/` (pure engine) and a `data/` (baked YAML). A domain's
core may import its own data and nothing else — not another domain, not the
adapter, not the contract. Purity is enforced generically over `domains.*.core`
by import-linter (ADR-0003 §3).
"""
