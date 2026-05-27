# Scenario exploration — bulk send 32 missing subscribers

**Seed:** `POST /api/whatsapp/admin/group-invite/bulk` (revised G1-G13 spec). Admin clicks **Convidar todos** on `/dashboard/wa/coverage` with 32 destinatários in the **Faltam Convidar** bucket. Endpoint runs preflight G1-G10, acquires `WaBatch` lock (G11), server-derives recipients (G7), sends Meta template `convite_grupo_whatsapp` (pt_PT) with randomized 3-7 min gap, persists per-phone `WaBatchItem` + `WaOutbound`, closes batch.

**Spec:** `docs/superpowers/specs/2026-05-27-wa-group-invite-design.md`
**Implementation plan:** `docs/superpowers/plans/2026-05-27-wa-guardrails-meta.md` (PR-G of Wave 3)

**Config:**
- Domain: software/API
- Depth: standard (25 iterations)
- Focus: **edge cases** (boundary conditions, off-by-ones, unicode, race conditions)
- Format: test scenarios (turn straight into integration tests in PR-G)

**Actors:**
- A1 — `admin` operator (Ricardo or Marcelo, cookie session)
- A2 — bulk endpoint (`POST /api/whatsapp/admin/group-invite/bulk`)
- A3 — `computeCoverage()` (Yogo + WaGroupMember reconciliation)
- A4 — Meta Cloud API (`sendTemplate`, template-status `GET /v21.0/{WABA_ID}/message_templates`)
- A5 — Turso DB (`WaBatch`, `WaBatchItem`, `WaOutbound`, `WaEvent`, `WaSetting`, `WaGroupMember`)

**Preconditions baseline (happy path):**
- VERCEL_ENV=production, WA_OUTBOUND_ENABLED=true
- WA_GROUP_INVITE_URL matches regex AND ends with INVITE_URL_FINGERPRINT_PROD
- WaSetting `fingerprint_confirmed_by_<session>` written ≤24h ago
- WaEvent INVITE_URL_OK ≤24h
- max(WaGroupMember.importedAt) ≥ NOW-7d
- Meta template `convite_grupo_whatsapp` (pt_PT) status === "APPROVED"
- No open WaBatch with kind="invite"
- WA_BULK_MAX ≥ recipients.length

**Postconditions (happy path):**
- WaBatch status="done", finishedAt set, recipients=32
- 32 WaBatchItem rows with outcome in {sent, skipped, failed}
- N WaOutbound rows where outcome="sent" with templateKey="grp_invite"
- N WaEvent rows kind="GROUP_INVITE_SENT"
- OOB notify event logged (OK or FAIL)

## Dimension coverage targets

| Dimension | Iters allocated | Severity weighting |
|---|---|---|
| edge_case | 12 | boundary errors → bug magnet |
| error_path | 3 | each preflight gate |
| concurrent | 3 | locks + pause/resume |
| integration | 3 | Meta API edges |
| temporal | 1 | timestamp boundaries |
| data_variation | 1 | unicode names |
| recovery | 1 | crash mid-batch |
| state_transition | 1 | batch lifecycle |

**Total:** 25.

## What this exercise produces

- `scenarios.md` — 25 test-scenario-formatted situations.
- `edge-cases.md` — extracted edge cases ordered by severity, ready to become integration test cases.
- `scenario-results.tsv` — per-iteration log (iteration, dimension, classification, severity, title, parent).
- `summary.md` — executive summary + recommendations for PR-G implementation.
