# Candidate B — WhatsApp Bot v1 Plan (post-critique)

## 1. Goal

Pull-based WhatsApp bot for Striker's House students. Three flows, one cron. **Hard "done" criteria:** 10 real bookings + 5 real cancellations across 5+ distinct students complete end-to-end with <2% Yogo error rate, and one trial-followup cron run delivers to ≥90% of yesterday's trial attendees, all observable via a `WaEvent` audit table queryable from psql/Turso CLI. N=1 is not acceptance — the bot must survive a week of Marcelo's class roster without intervention.

## 2. Files likely to change

**New:**
- `prisma/schema.prisma` — datasource flip to `sqlite` *or* `libsql` via `DATABASE_PROVIDER` (Slice 0), models: `WaContact`, `WaInbound`, `WaSession`, `WaOutbound`, `WaEvent`.
- `src/lib/db.ts` — Prisma client singleton
- `src/lib/phone.ts` — E.164 normaliser + match-table builder, fully unit-tested
- `src/lib/wa/meta.ts` — Cloud API wrappers + `verifySignature(rawBody, header)` with `crypto.timingSafeEqual`
- `src/lib/wa/raw-body.ts` — App Router raw-body preservation
- `src/lib/wa/session.ts` — state machine, 10-min TTL, `version` column for optimistic locking
- `src/lib/wa/handlers/{reservar,cancelar,fallback}.ts`
- `src/lib/wa/render.ts` — class → WA list row (title ≤24c, desc ≤72c, ≤10 rows; split by day if >10)
- `src/lib/yogo/lookup.ts` — `findCustomerByPhone(e164)` probes 3 stored variants
- `src/lib/yogo/signups.ts` — wraps a new `yogoFetch()` extracted from `yogo-proxy.ts`
- `src/app/api/whatsapp/webhook/route.ts` — `POST`: read raw → HMAC → dedupe → 200 in <50ms → `waitUntil(process)`
- `src/app/api/cron/trial-followup/route.ts` — Bearer-gated
- `vercel.json` — patched (read existing first)
- `vitest.config.ts`, `tests/**`

**Edited:**
- `src/lib/yogo-proxy.ts` — extract `yogoFetch()` (isolated PR, no feature code)
- `.env.example` — DB + WA + cron secrets

## 3. Existing patterns

- `src/lib/yogo-proxy.ts:1` — Yogo headers, reusable
- `src/lib/constants.ts:19` — TRIAL_CLASS_TYPE_ID + TRIAL_CLASS_PASS_ID
- `src/lib/utils.ts:115` — parseReport()
- `src/lib/utils.ts:108` — isNonActionableLead()
- `src/app/dashboard/trials/page.tsx:103` — class-list query shape with signup populate (better source than `dashboard/page.tsx:105`)
- `prisma/schema.prisma` empty — Slice 0 flip is mechanical but isolated

## 4. Plan — gates + 6 slices

**Pre-Slice gates (must close before any PR):**
- (G1) WA System User permanent token issued — verify by curling `/me` 25h later
- (G2) Phone normalisation spike — dump `/reports/customers`, run draft normalize, assert ≥98% map to single E.164. **Without this number documented, Slice 2 cannot start.**
- (G3) Meta template `trial_followup_pt` submitted (24-48h lead)

**Slice 0 — Test harness + phone normaliser (~150 LOC)**
Vitest + coverage. `src/lib/phone.ts` with table-driven tests: +351 9xx, 00351, 9xxxxxxxx bare, spaces, brackets, leading 351 no +, foreign (+55, +44 passthrough). Output `{ e164, variants: [e164, withoutPlus, national9] }`. No prod WA code yet.

**Slice 1 — Persistence migration, isolated (~80 LOC, no features)**
Turso via Marketplace. `DATABASE_PROVIDER` env. Schema flip to `libsql`. Empty migration. `src/lib/db.ts`. Extract `yogoFetch()` from `yogo-proxy.ts`. **Smoke: `npm run build` + every existing dashboard page renders.** Rollback = single revert.

**Slice 2 — Webhook skeleton, dedupe, audit (~250 LOC)**
Models: `WaContact(phoneE164 @id, yogoCustomerId?, firstSeenAt)`, `WaInbound(metaId @unique, phoneE164, body, receivedAt)`, `WaOutbound(id, phoneE164, kind, payload, status, error, sentAt)`, `WaEvent(id, kind, phoneE164?, meta json, createdAt)`. `GET` verify. `POST`: raw → HMAC verify (fail → 401 + WaEvent HMAC_FAIL) → upsert WaInbound by metaId (dup → 200 noop) → **200 in <50ms** → `waitUntil` runs echo handler.

**Slice 3 — Reservar flow (~350 LOC, behind `WA_FLOW=reservar`)**
1. Customer lookup — miss → "Não te encontrámos. Escreve ao Marcelo." + WaEvent
2. Fetch classes today+tomorrow excl. full + already signed
3. ≤10 → single list. >10 → day-header rows; if still >10 → "Escreve `mais` para amanhã"
4. State AWAIT_CLASS_PICK (TTL 10min). Pick → AWAIT_CONFIRM_BOOK with class name+time
5. Confirm → createSignup. Map Yogo errors: 409 "já inscrito", 403 "sem plano activo", 5xx "tenta outra vez"
6. New inbound while in state → version-checked transition; "cancelar"/"reserva" always reset to IDLE

**Slice 4 — Cancelar flow (~200 LOC)**
listFutureSignups filtered start>now. 0 → "Sem aulas marcadas". 1 → confirm directly (no list). 2-10 → list. >10 → "Tens N marcações, qual? Escreve DD/MM HH:MM" fallback. **Confirmation mandatory even for N=1.** Cancel only allowed `start_time > now + 15min` (mid-class protection).

**Slice 5 — Trial followup cron (~150 LOC)**
vercel.json `{ crons: [{ path: "/api/cron/trial-followup", schedule: "0 10 * * *" }] }`. **DST fix:** route reads Europe/Lisbon wall clock via Intl.DateTimeFormat and **exits early if local hour ≠ 11**, schedule BOTH `0 10 * * *` and `0 11 * * *` — only one matches per day. Yesterday's classes filtered `class_type[]=21792`, signups where `checked_in_at != null`, filter isNonActionableLead, dedupe via `(phoneE164, kind='trial_followup', dateKey=YYYY-MM-DD)` unique index. Bearer-gate.

**Slice 6 — Kill switch + observability (~80 LOC)**
`WA_ENABLED=false` short-circuits POST to ack-only. `/api/whatsapp/health` (admin-gated) returns last 24h WaEvent counts by kind. No dashboard UI in v1 — Marcelo runs daily psql in runbook.

## 5. Risks

| # | Risk | P/I | Mitigation |
|---|---|---|---|
| 1 | Phone normalisation misses real customers | H/H | G2 gate blocks Slice 2. 3-variant probe + LOOKUP_MISS audit + weekly review |
| 2 | Turso/libsql vs Prisma 7 quirks | M/M | Slice 1 ships ONLY migration. Build smoke covers all pages |
| 3 | Meta retries cause duplicate bookings | H/H | metaId @unique checked BEFORE side effects; ack <50ms; processing in waitUntil |
| 4 | Yogo cold-start >10s | M/M | Ack precedes processing. Errors mapped not retried |
| 5 | DST flip skips/doubles cron | M/H | Dual schedule + Europe/Lisbon early exit + dateKey dedupe |
| 6 | Template rejected/delayed | M/M | G3 submits early. Cron logs intent but doesn't send if unapproved |
| 7 | HMAC raw-body mangling in App Router | M/H | raw-body.ts; req.text() once; JSON parsed from same string; fixture-tested |
| 8 | Cancellation picks wrong class | L/H | Mandatory confirmation even N=1; start_time > now+15min |
| 9 | Lookup latency without cache | M/L | Accepted v1. Schema reserves WaContact.yogoCustomerId for v1.1 backfill |
| 10 | Yogo token expiry Oct 2026 | L/H | Out of scope. WaEvent YOGO_401 surfaces early |
| 11 | GDPR — message bodies in Turso | M/M | WaInbound.body purged at 90d via cron DELETE; documented in runbook; no PII in WaEvent.meta |
| 12 | State desync on rapid messages | M/M | WaSession.version optimistic lock; conflict → discard older + log SESSION_RACE |

**Unknowns to resolve in Slice 2/3:** exact Yogo error code for "no active membership"; whether `/customers?phone=` accepts partial or exact E.164; whether `signups.checked_in_at` vs `signups.attended` is correct trial marker.
