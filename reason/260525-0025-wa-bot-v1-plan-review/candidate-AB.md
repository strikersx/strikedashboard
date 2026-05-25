# Candidate AB — Synthesized WA Bot v1 Plan

## 1. Goal

Three pull flows (`reserva`, `cancelar`, fallback) plus one daily trial-followup cron at 11h Lisboa. **Done =** 10 real bookings + 5 cancellations across ≥5 distinct students with <2% Yogo error rate over one week of Marcelo's roster; one cron run delivers to ≥90% of yesterday's trial attendees; every inbound/outbound observable in `WaEvent`. Single-shot demos do not count.

## 2. Files likely to change

**New:**
- `prisma/schema.prisma` — flip provider to `libsql` via `DATABASE_PROVIDER`; add models `WaContact`, `WaInbound`, `WaSession`, `WaOutbound`, `WaEvent`
- `src/lib/db.ts` — Prisma singleton
- `src/lib/phone.ts` — E.164 normaliser returning `{e164, variants:[e164, withoutPlus, national9]}`
- `src/lib/wa/meta.ts` — Graph API send + `verifySignature` using `crypto.timingSafeEqual`
- `src/lib/wa/raw-body.ts` — App Router raw-body preservation
- `src/lib/wa/session.ts` — state machine, 10-min TTL, version column for optimistic locking
- `src/lib/wa/dispatch.ts` + `handlers/{reservar,cancelar,fallback}.ts`
- `src/lib/wa/render.ts` — class → WA list row (title ≤24c, desc ≤72c, ≤10 rows, split by day)
- `src/lib/yogo/lookup.ts` — `findCustomerByPhone` probes 3 variants; logs LOOKUP_MISS
- `src/lib/yogo/signups.ts`
- `src/app/api/whatsapp/webhook/route.ts`
- `src/app/api/cron/trial-followup/route.ts`
- `vitest.config.ts`, `tests/**`, `vercel.json` (patched), `.env.example`

**Edited:**
- `src/lib/yogo-proxy.ts` — extract `yogoFetch` in isolated PR with NO feature code
- `package.json` — +@libsql/client, +vitest

## 3. Existing patterns found

- `yogo-proxy.ts:1` — token + headers reusable
- `constants.ts:19` — TRIAL_CLASS_TYPE_ID=21792, TRIAL_CLASS_PASS_ID=14172
- `utils.ts:115` — parseReport()
- `utils.ts:108` — isNonActionableLead()
- `dashboard/trials/page.tsx:103` — class-list query with signup populate (better source than dashboard/page.tsx:105)
- `prisma/schema.prisma` empty — provider flip is mechanical but not silent

## 4. Smallest implementation plan

### Pre-slice gates
- **G1** — Permanent WA System User token (curl /me at T+25h)
- **G2** — Phone normalisation spike (blocks S3). Dump all ~700 from /reports/customers, draft normalize(), assert ≥98% map to single E.164. Without this number, S3 cannot start.
- **G3** — Meta template trial_followup_pt submitted (24–48h Meta review)

### Slice 0 — Test infra + phone (~150 LOC)
Vitest + coverage. phone.ts table-driven tests covering +351 9xx, 00351, bare 9xxxxxxxx, spaces, brackets, leading 351 no +, foreign passthrough.

### Slice 1 — Turso + yogoFetch extraction (~80 LOC, zero features)
Turso via Marketplace, DATABASE_PROVIDER, schema flip libsql, empty migration, db.ts singleton, extract yogoFetch. **Smoke:** npm run build + every dashboard page renders. Rollback = single revert.

### Slice 2 — Webhook skeleton + audit (~250 LOC)
Models WaContact/WaInbound/WaSession/WaOutbound/WaEvent. GET verify. POST: raw → HMAC verify (fail 401 + HMAC_FAIL event) → upsert WaInbound by metaId BEFORE side effects (dup → 200 noop) → 200 in <50ms → waitUntil runs echo handler.

### Slice 3 — `reservar` flow (~350 LOC, behind WA_FLOW=reservar)
Lookup miss → polite + LOOKUP_MISS. Classes today+tomorrow excl full + already-signed. ≤10 single list / >10 day headers / still >10 "Escreve mais para amanhã". AWAIT_CLASS_PICK (TTL 10min). Pick → AWAIT_CONFIRM_BOOK with name+time. Confirm → createSignup. Map 409/403/5xx. New inbound mid-state → version-checked transition. "cancelar"/"reserva" literals always reset to IDLE.

### Slice 4 — `cancelar` flow (~200 LOC)
listFutureSignups start>now. 0 → "Sem aulas marcadas". 1 → confirm directly. 2-10 → list. >10 → "Tens N marcações, escreve DD/MM HH:MM" free-text fallback. Confirmation mandatory even N=1. Allowed only start_time > now+15min.

### Slice 5 — Trial follow-up cron (~150 LOC)
vercel.json schedules BOTH 0 10 * * * and 0 11 * * *; route reads Europe/Lisbon wall clock via Intl.DateTimeFormat, exits early unless local hour == 11. Filter class_type[]=21792, checked_in_at != null, isNonActionableLead, dedupe via unique index on (phoneE164, kind='trial_followup', dateKey). Bearer-gated. Template pending → TEMPLATE_PENDING log, skip send.

### Slice 6 — Operational guardrails (~80 LOC)
WA_ENABLED=false short-circuits POST. /api/whatsapp/health admin-gated. No /dashboard/chat inbox v1.

Total ~1260 LOC across 7 slices.

## 5. Risks & unknowns

| # | Risk | P/I | Mitigation |
|---|---|---|---|
| 1 | Phone normalisation gaps | H/H | G2 gate, 3-variant probe, weekly LOOKUP_MISS review |
| 2 | Turso/libsql vs Prisma 7 | M/M | Slice 1 migration-only; full build smoke; single revert |
| 3 | Meta retries duplicate bookings | H/H | metaId @unique BEFORE side effects; ack <50ms; waitUntil |
| 4 | Yogo cold-start >10s | M/M | Ack precedes processing; errors mapped not retried |
| 5 | DST flip | M/H | Dual schedule + Europe/Lisbon early-exit + dateKey dedupe |
| 6 | Template rejected/delayed | M/M | G3 early submit; cron TEMPLATE_PENDING log |
| 7 | HMAC + App Router raw body | M/H | raw-body.ts; req.text() once; JSON from same string; fixture-tested |
| 8 | Cancelling wrong class | L/H | Mandatory confirm even N=1; start_time > now+15min |
| 9 | Lookup latency | M/L | Accepted v1; WaContact.yogoCustomerId reserved for v1.1 backfill |
| 10 | Yogo token expiry Oct 2026 | L/H | Out of scope; YOGO_401 surfaces early |
| 11 | GDPR retention | M/M | WaInbound.body purged 90d via cron DELETE; runbook; no PII in WaEvent.meta |
| 12 | State desync rapid messages | M/M | WaSession.version optimistic lock; SESSION_RACE log |

**Unknowns to resolve in S3/S5:** exact Yogo error code for "no active membership"; whether /customers?phone= accepts partial or requires exact E.164; whether signups.checked_in_at vs signups.attended is correct trial marker.
