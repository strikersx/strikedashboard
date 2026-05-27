---
commit_hash: e4322bac631e5c37fb6dbf9cb1b3c459ae587ac3
---

## Clusters and risk areas (wrong-group-send lens)

| Cluster | Files | Risk Areas (this lens) |
|---------|-------|------------------------|
| Group invite link config | env-only (`WA_GROUP_INVITE_URL`) | unscanned, unfingerprinted, no admin-side verification; rotation requires Vercel env redeploy; preview env may inherit prod link |
| Recipient list derivation | group-coverage.ts, recurring-subs.ts, phone.ts | depends on freshness of WaGroupMember roster (manual paste); phone normalization is the single matching primitive — any bug here mis-targets at scale |
| Roster ingest (`/group-members/import`) | group-import.ts, import/route.ts | full-replace semantics = a bad paste deletes the entire roster, causing all 80 subs to appear "missing" → bulk re-invite to everyone |
| Bulk send executor (planned) | group-invite/bulk/route.ts | no batch-level kill switch; idempotency relies on a 30-day window + WaOutbound upsert; partial-failure recovery unclear |
| Migration runner | migrate-turso.mjs | no transactional wrapping; no schema-diff dry-run; no backup snapshot before applying |
| Template config | meta.ts sendTemplate; spec | template name is a literal string in code; if Meta template gets renamed/disapproved silently, sends fail; parameter order is positional (`{{1}}` name, `{{2}}` URL) — swap = link in name field |
| Auth surface | lib/auth.ts (cookie role) | admin cookie is single-factor; no MFA; anyone with the cookie can trigger bulk send |
| Audit trail | WaEvent kind="GROUP_INVITE_SENT/FAIL" | append-only events; no consolidated audit page for "what did we send today, to whom" |
| Multi-environment safety | (no current guard) | dev/preview Vercel deployments share the same DATABASE_URL and YOGO_TOKEN as prod → preview Convidar Todos hits prod |
