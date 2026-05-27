# Predict Analysis — WA Group Invite Guard Rails

**Date:** 2026-05-27 00:01 UTC
**Scope:** WA invite feature surface — `src/lib/wa/**`, `src/lib/yogo/**`, `src/lib/phone.ts`, `src/lib/db.ts`, `src/app/api/whatsapp/**`, `src/app/dashboard/wa/**`, `prisma/**`, `scripts/migrate-turso.mjs`, the bulk-send spec
**Personas:** 5 (Operator, Migrations & Data Integrity, Bulk-Ops & Distributed Systems, Security/Privacy, Devil's Advocate)
**Debate Rounds:** 2 completed
**Commit Hash:** `e4322bac`
**Anti-Herd Status:** ✅ PASSED (flip_rate=0.27, entropy=0.71, convergence=2 rounds)

## Summary

- **Total Findings:** 19
  - Confirmed (≥3 of 5): 18
  - Probable (2 of 5): 1
  - Minority preserved: 1
- **Severity Breakdown:** Critical: 5 · High: 8 · Medium: 4 · Low: 2
- **Composite Score:** 247

## The 5 critical findings (the "must-have" guard rails)

1. **Preview/non-prod deployments share prod creds** — gate bulk endpoint on `VERCEL_ENV === "production"` + code-side URL fingerprint
2. **Bulk endpoint trusts client-supplied recipient list** — drop `phoneE164s` from request; derive list server-side from `computeCoverage()`
3. **No outbound kill switch** — add `WA_OUTBOUND_ENABLED` flag, default `false` in non-prod
4. **Roster import is full-replace; bad paste nukes everything** — soft-delete with `archivedAt` + 50% threshold guard
5. **No invite-URL integrity guard** — regex + code-side fingerprint + operator-confirmed last-6-chars + daily health check

## Recommended implementation order

| Wave | Findings | Why this order |
|------|----------|----------------|
| **Pre-deploy (blocker)** | 1, 3, 5 | Without these, every Convidar Todos click is gambling on env hygiene |
| **Pre-send (blocker)** | 2, 4, 9, 10, 12 | Recipient-list integrity + UI/confirm + roster freshness + template approval |
| **During-send (resilience)** | 6, 7, 11, 13, 14 | Lock, cap, notify, checkpoint, throttle |
| **Migration hygiene (parallel)** | 8, 17 | Linter + dump for `migrate-turso.mjs` |
| **Polish** | 15, 16, 18 | UX separation, OOB notification, payload PII minimisation |
| **Cost optimization (minority)** | 19 | Try UTILITY template first |

## Files in This Report

- [Findings](./findings.md) — 19 ranked findings with evidence, recommendations, persona votes
- [Hypothesis Queue](./hypothesis-queue.md) — testable hypotheses for downstream chain consumption
- [Persona Debates](./persona-debates.md) — full 2-round debate transcript
- [Codebase Analysis](./codebase-analysis.md) — knowledge file: functions, schema, env, routes
- [Dependency Map](./dependency-map.md) — knowledge file: data flow, control flow gaps
- [Component Clusters](./component-clusters.md) — knowledge file: risk areas per cluster

## Notes for the implementation plan

The findings cluster naturally into **6 implementation work-blocks**:

1. **Environment gating + URL integrity** (Findings 1, 3, 5, 9) — `lib/wa/config.ts` + endpoint preflight
2. **Recipient list trust model** (Findings 2, 7) — change endpoint contract
3. **Roster safety** (Findings 4, 12) — soft-delete + age enforcement
4. **Batch lifecycle** (Findings 6, 13, 14) — new `WaBatch` model + 5min gap
5. **UX hardening** (Findings 10, 15) — typed-count confirm + visual separation
6. **Observability + audit** (Findings 11, 16, 18) — OOB notification + payload scrub

When ready, run `/autoresearch:predict --chain fix` or invoke `writing-plans` with this overview as input.

The spec at `docs/superpowers/specs/2026-05-27-wa-group-invite-design.md` should be updated to incorporate these guard rails before implementation begins.
