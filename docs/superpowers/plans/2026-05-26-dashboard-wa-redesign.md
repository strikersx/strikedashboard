---
title: Dashboard /wa Redesign — Plan
date: 2026-05-26
author: claude
status: draft
---

# Dashboard `/wa` Redesign — Plan

## 1. Goal + non-goals

**Goal.** Replace the current dev-flavoured `/dashboard/wa` page with an ops-focused view that answers three questions Marcelo and Ricardo actually ask:

1. *Is the bot up?* — single pill at the top.
2. *Is the bot working?* — KPIs over a 7-day window (booking volume, cancellation volume, unique students, failure rate).
3. *Who talked to the bot, and what did they say?* — conversation list grouped by phone.

Plus a failures-only feed so anything that genuinely needs a human is visible at a glance.

**Non-goals.**
- No "Repor sessão" button (self-healing keyword + 10 min TTL already does this — see `src/lib/wa/dispatch.ts` lines 47, 54, 66).
- No raw `WaEvent.meta` JSON in the UI. Failures get human-readable one-liners; if Ricardo needs raw meta he runs SQL.
- No per-event filter, no search, no pagination. 7 days × ~3 people × low traffic → page fits on screen.
- No write actions of any kind. The admin reset endpoint goes away.
- No real-time push / SSE. 10s polling stays.

## 2. Audience analysis

| Section | Who reads it | Why |
|---|---|---|
| Header health pill | Marcelo (recepção, telemóvel) | "O bot está ligado?" — binary glance |
| KPI strip (7d) | Ricardo (laptop), Marcelo (telemóvel) | "Vale a pena ter o bot?" — Ricardo. "Quantas reservas chegaram via bot hoje?" — Marcelo. |
| Conversations | Marcelo primarily | "Quem é o `+351912…`? Que disseram?" Used when an aluno chega à recepção e pergunta sobre uma reserva. |
| Failures feed | Ricardo primarily | "Algum bug?" Marcelo só usa se Ricardo lhe disser "olha a página, tem coisas a vermelho?" |

The line: the page must be readable on Marcelo's phone first. Anything that doesn't pass the "Marcelo on the reception phone" test is out, even if Ricardo would like it.

## 3. Data sources

All Prisma queries hit Turso (libsql) in prod, SQLite locally. Same SQL.

### 3.1 Health pill
Already covered by `isWaEnabled()` from `src/lib/wa/config.ts`. Reused as-is.

### 3.2 KPIs (window: rolling 7 days, plus "hoje" = since 00:00 Lisbon)

| KPI | Source | Query sketch |
|---|---|---|
| Reservas hoje | `WaEvent` | `count where kind='BOOKING_OK' AND createdAt >= startOfDayLisbon` |
| Reservas 7d | `WaEvent` | `count where kind='BOOKING_OK' AND createdAt >= now-7d` |
| Cancelamentos hoje | `WaEvent` | `count where kind='CANCEL_OK' AND createdAt >= startOfDayLisbon` |
| Cancelamentos 7d | `WaEvent` | `count where kind='CANCEL_OK' AND createdAt >= now-7d` |
| Alunos únicos 7d | `WaInbound` | `groupBy phoneE164 where receivedAt >= now-7d` → `.length` |
| Taxa de falha 7d | `WaEvent` | `(fails) / (fails + oks) * 100` where ok kinds = `BOOKING_OK, CANCEL_OK, TEMPLATE_SENT` and fail kinds = `BOOKING_FAIL, CANCEL_FAIL, HMAC_FAIL, SEND_FAIL, DISPATCH_FAIL, TEMPLATE_FAIL`. `LOOKUP_MISS` is **not** a failure (intentional fallback). `SESSION_RACE` is **not** a failure (benign). `TEMPLATE_PENDING` is **not** a failure (waiting on Meta approval). |

`groupBy + count` is supported by Prisma directly; `eventsByKind` already uses it in `health/route.ts`. The unique-students count is a `groupBy phoneE164` with `_count.phoneE164` on `WaInbound` — single round-trip.

"Hoje" boundary uses Lisbon midnight. There is already a `src/lib/wa/lisbon.ts` helper — reuse it.

### 3.3 Conversations (grouped by phone, last 7 days)

Query: `WaInbound.findMany({ where: { receivedAt: { gte: now-7d } }, orderBy: { receivedAt: 'desc' }, take: 200 })` then group in memory by `phoneE164`. 200 messages over 7 days is a generous ceiling for current volume; if it ever bumps against it Ricardo will see the cap and we paginate.

For each phone, derive:
- `phoneE164`
- `lastBody` (first item after grouping = newest)
- `lastAt` (`receivedAt` of newest)
- `inboundCount` (size of group)
- `outboundCount` (from a parallel `WaOutbound` query in same window — group same way)
- `studentName?` — see §3.4

### 3.4 Yogo name lookup
Use `findCustomerByPhone(e164)` from `src/lib/yogo/lookup.ts`. It already caches the customer list for 60s, so calling it once per unique phone in the conversation list is cheap.

Two cases:
- **Hit** → show `first_name last_name`.
- **Miss** → show *"Não identificado"* and a small grey badge. Document in code that this is the LOOKUP_MISS population — Marcelo can search Yogo manually if the phone matters.

`WaContact.yogoCustomerId` is null in v1 by design, per the spec. **Do not** rely on it. If a future sprint backfills it, the lookup path can short-circuit to a single DB read — but that's not part of this plan.

### 3.5 Conversation thread (when a phone is tapped)
Two parallel queries, scoped to that phone, last 7 days, `take: 30` each:
- `WaInbound.findMany({ phoneE164, receivedAt >= now-7d })` → `{ body, receivedAt }`
- `WaOutbound.findMany({ phoneE164, sentAt >= now-7d })` → `{ kind, status, sentAt }`

Merge client-side by timestamp, render as a chat-style list (inbound left, outbound right). Outbounds never show full payload (it can be a 2 KB list interactive JSON) — only `kind` + `status`.

### 3.6 Failures feed (last 7d, cap 20)
```ts
WaEvent.findMany({
  where: {
    createdAt: { gte: now-7d },
    kind: { in: ['BOOKING_FAIL','CANCEL_FAIL','HMAC_FAIL','SEND_FAIL','DISPATCH_FAIL','TEMPLATE_FAIL','TEMPLATE_PENDING','LOOKUP_MISS'] }
  },
  orderBy: { createdAt: 'desc' },
  take: 20,
  select: { id: true, kind: true, phoneE164: true, createdAt: true }
});
```
`LOOKUP_MISS` and `TEMPLATE_PENDING` are included as the user spec requested even though they aren't strictly failures — they need a human to look. `meta` is **not** selected.

Each row gets a server-side human-readable line driven by a small `kind → string` map (PT-PT):
- `BOOKING_FAIL` → "Falha a criar reserva no Yogo"
- `CANCEL_FAIL` → "Falha a cancelar no Yogo"
- `HMAC_FAIL` → "Assinatura inválida — verificar `WA_APP_SECRET`"
- `SEND_FAIL` → "Falha a enviar mensagem ao WhatsApp"
- `DISPATCH_FAIL` → "Crash no handler — ver logs"
- `TEMPLATE_FAIL` → "Template rejeitado pela Meta"
- `TEMPLATE_PENDING` → "Template à espera de aprovação"
- `LOOKUP_MISS` → "Número não identificado no Yogo"

## 4. Page layout (mobile-first)

```
┌─────────────────────────────────────────┐
│ WhatsApp bot              [● ATIVO]    │   header (sticky in dashboard layout)
├─────────────────────────────────────────┤
│ KPIs (2-col grid on mobile, 3-col md+)  │
│ ┌──────────┐ ┌──────────┐               │
│ │ Reservas │ │ Cancel.  │               │
│ │ hoje  3  │ │ hoje  0  │               │
│ │ 7d   18  │ │ 7d    2  │               │
│ └──────────┘ └──────────┘               │
│ ┌──────────┐ ┌──────────┐               │
│ │ Alunos   │ │ Falhas   │               │
│ │ 7d   12  │ │ 7d   4%  │               │
│ └──────────┘ └──────────┘               │
├─────────────────────────────────────────┤
│ CONVERSAS  (últimos 7 dias)             │
│ ┌─────────────────────────────────────┐ │
│ │ João Silva  +351912…  · há 12 min   │ │
│ │ "reserva"                           │ │
│ ├─────────────────────────────────────┤ │
│ │ Não identificado  +44…   · há 2 h   │ │
│ │ "cancelar"                          │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ ALERTAS  (4)                            │
│ ┌─────────────────────────────────────┐ │
│ │ ⚠ +44…  · há 2h                     │ │
│ │   Número não identificado no Yogo   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

Tap a conversation row → in-page expansion (no modal — modals on mobile are awkward, expansion keeps context). Expansion shows the merged thread up to 30 messages.

Styling: use existing `StatCard` from `src/components/stat-card.tsx` for the KPI strip (already mobile-responsive, already follows the colour map). Use `bg-surface border-border-subtle rounded-xl` containers for the lists — same pattern as the home page recent-subscriptions block.

Colours (per project rule): `electric` (success/booking), `amber` (cancellation/warning), `blue` (alunos únicos), `coral` (taxa de falha). Match home page semantic mapping.

## 5. What to delete

| Path | Action | Why |
|---|---|---|
| `src/app/dashboard/wa/page.tsx` (current 315 LOC) | **Rewrite** | Over-engineered, mixes 4 list sections + reset button |
| `src/app/api/whatsapp/admin/reset-session/route.ts` | **Delete** | Self-healing via keyword + TTL already solves stuck sessions (`dispatch.ts:54`). No real-world need observed since launch. |
| `src/app/api/whatsapp/health/recent/route.ts` | **Delete** | Replaced by `/api/whatsapp/conversations` (grouped) + `/api/whatsapp/failures` (or fold into a single `/api/whatsapp/overview`). Returning inbounds + outbounds + events + sessions in one bag was the source of the over-engineering. |
| `src/app/api/whatsapp/health/route.ts` | **Keep, simplify** | Drop `sessions.active/expired` (UI never showed them meaningfully and they're irrelevant). Keep `enabled` flag — it's the source of the header pill. Optionally rename to just return `{ enabled }` if we fold KPIs into a new endpoint; see §6. |

**Decision needed on `/api/whatsapp/health` shape** — see §10.

## 6. New endpoints

Two new admin-only endpoints. Both check `getSession()` and return 403 unless role is `admin`.

### 6.1 `GET /api/whatsapp/stats`
```ts
{
  enabled: boolean,                  // from isWaEnabled()
  generatedAt: string,
  today:    { bookings: number, cancellations: number },
  last7d:   { bookings: number, cancellations: number, uniqueStudents: number, failureRate: number /* 0..100 */ }
}
```
Single Prisma round-trip with `Promise.all` of 5 queries (4 `count` + 1 `groupBy phoneE164`).

### 6.2 `GET /api/whatsapp/conversations`
```ts
{
  conversations: Array<{
    phoneE164: string,
    studentName: string | null,      // null = LOOKUP_MISS population
    lastBody: string,                // truncated to 80 chars server-side
    lastAt: string,
    inboundCount: number,
    outboundCount: number,
  }>,
  failures: Array<{
    id: string,
    kind: string,
    phoneE164: string | null,
    createdAt: string,
    description: string,             // human PT-PT one-liner from §3.6 map
  }>
}
```
Both lists 7-day windowed. Conversations sorted by `lastAt desc`, capped at 30 phones (more than that on mobile is unreadable anyway).

### 6.3 `GET /api/whatsapp/conversations/[phone]/thread`
```ts
{
  messages: Array<{ direction: 'in' | 'out', body?: string, kind?: string, status?: string, at: string }>
}
```
Used when a row is expanded. 30-message cap. Path param is the E.164 string (URL-encoded `+`).

The split into `/stats` + `/conversations` keeps responsibilities clean; if Ricardo prefers one fat endpoint to halve the polling, fold them into `/api/whatsapp/overview` — see §10.

## 7. File-level changes

| File | Action | Approx LOC |
|---|---|---|
| `src/app/dashboard/wa/page.tsx` | Rewrite | ~150 |
| `src/components/wa/wa-conversation-row.tsx` | Create | ~60 |
| `src/components/wa/wa-conversation-thread.tsx` | Create (in-page expansion) | ~70 |
| `src/components/wa/wa-failure-row.tsx` | Create | ~40 |
| `src/lib/wa/event-descriptions.ts` | Create — `kind → PT-PT one-liner` map | ~30 |
| `src/app/api/whatsapp/stats/route.ts` | Create | ~60 |
| `src/app/api/whatsapp/conversations/route.ts` | Create | ~90 |
| `src/app/api/whatsapp/conversations/[phone]/thread/route.ts` | Create | ~50 |
| `src/app/api/whatsapp/health/route.ts` | Edit — strip `last24h` + `sessions`, keep `{enabled, generatedAt}` (or delete and source `enabled` from `/stats`) | ~15 |
| `src/app/api/whatsapp/health/recent/route.ts` | Delete | — |
| `src/app/api/whatsapp/admin/reset-session/route.ts` | Delete | — |
| `docs/superpowers/runbooks/whatsapp-bot.md` | Edit — update curl examples to point at `/stats`, drop the `sessions` interpretation row, mention that `/dashboard/wa` no longer has the reset button | ~20 changed |

`page.tsx` budget: 150 LOC max. If it grows beyond that, the section components should absorb the overflow. Components stay under the 200 LOC project rule (well under).

## 8. Migration / rollout

- **Single PR.** Page + 3 new endpoints + 2 deletes + runbook edit fit in one reviewable diff.
- **No data backfill.** All data already in Turso.
- **No feature flag.** Page is admin-only and the bot still works regardless of dashboard UI state.
- **Order of operations in the PR:**
  1. Add new endpoints (still side-by-side with `/health/recent`).
  2. Rewrite `page.tsx` to consume new endpoints.
  3. Delete old endpoints + delete reset button code path.
  4. Edit runbook last so it matches shipped state.

That order keeps `main` deployable at each commit if Ricardo wants to land it incrementally.

## 9. Testing

| Behaviour | Approach | Notes |
|---|---|---|
| `/api/whatsapp/stats` count correctness | Unit test with seeded `WaEvent` rows hitting the 7d / today boundaries | Use the same Prisma test pattern as existing tests in `tests/lib/wa/` |
| `/api/whatsapp/conversations` grouping (newest message wins, count is correct) | Unit test with a phone that has 3 inbounds + 2 outbounds | Easy to assert. |
| Failure-rate math (especially: 0/0 should be 0, not NaN) | Unit test | One-liner edge case worth covering. |
| Yogo name lookup | Mocked — don't hit Yogo in tests | Mock `findCustomerByPhone` to return a fixed customer for one phone and `null` for another, assert `studentName` falls through correctly. |
| Admin-only gating | Already covered by `getSession()` pattern, but worth one integration assertion that `sales` role gets 403 on each new endpoint | |
| Visual / responsive | Manual smoke on Ricardo's phone + on desktop. No Playwright — overkill for an internal page. | |
| Auto-refresh polling | Manual: open the page, leave for 30s, watch network tab tick every 10s | |

Anything we explicitly do not test:
- The auto-refresh interval itself (`setInterval` is not worth unit-testing).
- The grouped Prisma `groupBy` against a real Turso instance (the local SQLite roundtrip is enough — same dialect).

## 10. Open questions / decisions for Ricardo

1. **`/api/whatsapp/health` — keep, slim, or fold?** Current page calls it for the `enabled` flag. Options:
   - **(a)** Slim it to `{enabled, generatedAt}` only. Cleanest split: `health` = liveness, `stats` = counts.
   - **(b)** Delete it entirely and put `enabled` into the `/stats` response. One fewer endpoint to think about.
   - **(c)** Keep the full shape for the curl one-liner in the runbook. The runbook reader (Marcelo on prod) would still see counts via curl.
   My recommendation: **(a)** — single responsibility, runbook curl still works.

2. **Conversation message bodies — full text or metadata only?** GDPR-wise the bot already stores `WaInbound.body` for 90 days (purged by the cron). Showing full bodies in the dashboard exposes them to whoever has admin (Ricardo + Marcelo, both data controllers). My read: **show full bodies**, truncated to 80 chars in the list and full in the expansion. They're already in the DB; we're not duplicating risk.

3. **Window: 7 days fixed, or settable?** Spec said 7d. I'd hold it there. If Marcelo asks for "last month" later, we add a single segmented toggle (`Hoje · 7d · 30d`) — that's a follow-up, not v1.

4. **Phone-search filter?** Not in v1. If Marcelo ever needs to find a specific number after the 30-phone cap, he can grep the runbook SQL. Add only when there's a real complaint.

5. **Modal vs in-page expansion for the conversation thread?** Plan says expansion. Worth one screenshot review with Ricardo on his phone before committing. Modals stack better when scrolling a long thread; expansion keeps the KPIs visible above. I'm picking expansion because the thread is capped at 30 messages — it won't push KPIs far off-screen.

6. **Failure feed alongside conversations, or as a separate `/dashboard/wa/alerts` page?** Plan puts both on one page because the volume is low (4-5 failures/week is a normal week). If failure volume ever becomes noisy enough to dominate the page, split it. Not now.

7. **Conversation row tap = expand the same row vs replace KPI strip with a "back" header?** Plan says expand row. The alternative (full-page drill-down) makes the page feel like an app, but adds routing complexity for an admin-only page used by 2 people. Expansion is simpler.
