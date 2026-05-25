# Overview — WA Bot v1 Plan Adversarial Review

**Date:** 2026-05-25
**Task:** Adversarially review the WhatsApp bot v1 implementation plan before code is written.
**Domain:** software
**Mode:** convergent
**Iterations:** 1 (bounded)
**Judges:** 3

## Result

**Winner: Candidate AB (synthesis)** — unanimous 3-0 in round 1.

## What changed from initial plan (A → AB)

The critic found **3 FATAL** and **8 MAJOR** weaknesses in the original brainstorm (A). All were either addressed or explicitly acknowledged in AB:

| Weakness | Resolution in AB |
|---|---|
| FATAL — class disambiguation hand-waved | Explicit state machine (`AWAIT_CLASS_PICK` etc), 10-min TTL, version optimistic lock, "cancelar"/"reserva" literals reset to IDLE |
| FATAL — phone normalisation is linchpin, "spike 3 alunos" not enough | Promoted to **pre-slice gate G2**: dump all ~700 customers, draft `normalize()`, assert ≥98% map to single E.164. **Without this number, Slice 3 cannot start** |
| FATAL — Turso migration silently bundled | Slice 1 = migration-only, **zero feature code**, full dashboard build smoke required; rollback = single revert |
| MAJOR — cron timezone/DST | Dual schedule `0 10 * * *` + `0 11 * * *`, route reads `Europe/Lisbon` via `Intl.DateTimeFormat`, exits early unless local hour == 11 |
| MAJOR — LOC fantasy (300 LOC for entire reserva flow) | Re-budgeted: Slice 3 alone = ~350 LOC for reservar, S4 = ~200 LOC for cancelar; total ~1260 LOC across 7 PRs |
| MAJOR — Meta retries → duplicate bookings | `WaInbound.metaId @unique` written **before** any side effect; ack 200 in <50ms; processing in `waitUntil` |
| MAJOR — N=1 success criteria | Done = 10 bookings + 5 cancellations across ≥5 students with <2% Yogo error rate over one week + ≥90% cron delivery; "single-shot demos do not count" |
| MAJOR — HMAC raw body | Dedicated `raw-body.ts`: `req.text()` once, JSON parsed from same string, fixture-tested against Meta payload examples |
| MAJOR — `cancelar` ambiguous with N>1 future signups | N=0 polite; N=1 confirm directly; N=2-10 list; N>10 free-text DD/MM HH:MM; mandatory confirmation even N=1; `start_time > now+15min` cutoff |
| MAJOR — "validar token" doesn't fix 24h expiry | Promoted to **pre-slice gate G1**: System User permanent token required, curl `/me` at T+25h |
| MAJOR — removing `yogoCustomerId` cache is perf regression | Acknowledged: `WaContact.yogoCustomerId` column reserved for v1.1 backfill (not populated in v1, accepted tradeoff) |
| MINOR — vercel.json may exist | "patched, not blind-created" |
| MINOR — GDPR retention | `WaInbound.body` purged at 90d via cron DELETE; no PII in `WaEvent.meta`; documented in runbook |
| MINOR — refactor mixed with feature PR | `yogoFetch` extraction is isolated PR with **no feature code** (Slice 1) |

## Top remaining risks (from AB)

1. **Phone normalisation gaps** (H/H) — gated by G2 before S3
2. **Meta retries → duplicate bookings** (H/H) — mitigated by metaId @unique BEFORE side effects + ack <50ms
3. **DST cron drift** (M/H) — dual schedule + Europe/Lisbon early-exit
4. **HMAC + App Router raw body** (M/H) — dedicated raw-body helper, fixture-tested

## Open unknowns (to resolve during slice work)

- Exact Yogo error code for "no active membership" on `createSignup`
- Whether `/customers?phone=` accepts partial or requires exact E.164
- Whether `signups.checked_in_at` vs `signups.attended` is correct trial marker

## Files

- [candidate-A.md](./candidate-A.md) — initial brainstorm
- [candidate-B.md](./candidate-B.md) — challenger after critique
- [candidate-AB.md](./candidate-AB.md) — synthesis (WINNER)
- [lineage.md](./lineage.md) — round trace
- [judge-transcripts.md](./judge-transcripts.md) — decoded judge reasoning
