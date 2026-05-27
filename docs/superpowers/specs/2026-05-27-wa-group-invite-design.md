---
title: WhatsApp group invite — bulk send from coverage page
type: design
date: 2026-05-27
status: approved (revised after /autoresearch:predict guard-rail pass)
predict_report: ../../../predict/260527-0001-wa-group-invite-guardrails/
---

# WhatsApp group invite — bulk send

## Why this exists

The `/dashboard/wa/coverage` page lists 32 active recurring subscribers who pay for the gym but are not in the official WhatsApp group. Marcelo wants to invite all of them in one action without manually copy-pasting the group link 32 times, and without accidentally re-inviting people he already invited.

WhatsApp Cloud API does not allow adding members to a group programmatically (Meta blocks that for privacy). The closest legal mechanism is sending each missing subscriber a pre-approved **template message** containing the group invite link.

This spec was revised after a multi-persona predict pass identified 5 CRITICAL and 8 HIGH guard-rail gaps. See `predict/260527-0001-wa-group-invite-guardrails/findings.md` for the full analysis. The guard rails are first-class requirements below, not nice-to-haves.

## Goal & scope

- Send a Meta-approved template containing the group invite link to every phone in the "Faltam convidar" bucket.
- Surface results inline on the coverage page (sent / skipped / failed).
- Make the action safe to re-run: skip anyone invited in the last 30 days unless the operator explicitly forces.
- Provide a single-recipient test channel so the operator can dry-run on their own number.
- **Make the wrong-group / wrong-recipient / wrong-environment failure modes structurally impossible** — see Guard Rails below.

**Out of scope this iteration:**
- Ex-clients win-back flow (separate feature)
- Group cleanup of "Desconhecidos no grupo" (separate feature)
- Detecting who actually joined the group (WhatsApp Cloud API does not emit a join event; rely on the next coverage Resync)

## Guard rails (first-class requirements)

These are the 5 critical and 8 high-severity preconditions a bulk send must satisfy. The endpoint refuses with a specific error code when any fail.

| # | Guard | Mechanism | Error code on fail |
|---|-------|-----------|-------------------|
| **G1** | Bulk only fires in production | `process.env.VERCEL_ENV === "production"` | 423 `outbound_disabled_non_prod` |
| **G2** | Outbound kill switch | `process.env.WA_OUTBOUND_ENABLED === "true"` | 423 `outbound_disabled` |
| **G3** | URL is a real WhatsApp invite | regex `^https://chat\.whatsapp\.com/[A-Za-z0-9]{15,30}$` | 400 `bad_invite_url_shape` |
| **G4** | URL matches the known production group | code-side constant `INVITE_URL_FINGERPRINT_PROD` = last 6 chars of the prod link, checked at endpoint entry | 423 `invite_url_fingerprint_mismatch` |
| **G5** | Operator confirmed the fingerprint this session | session cookie / DB flag set by the operator clicking "✓ Confirmo `AbCdEf`" on the coverage page | 412 `fingerprint_not_confirmed` |
| **G6** | URL health check passed in the last 24h | scheduled `HEAD` request logs `INVITE_URL_OK` / `INVITE_URL_DEAD` to `WaEvent`; endpoint reads most recent | 503 `invite_url_unhealthy` |
| **G7** | Recipient list is derived server-side | request body has NO `phoneE164s`; only `{ force, dryRun }` | 400 `unexpected_recipient_field` |
| **G8** | Hard send cap | derived recipients ≤ `Number(process.env.WA_BULK_MAX ?? 100)` | 400 `exceeds_cap` |
| **G9** | Group roster is fresh | `max(WaGroupMember.importedAt)` ≥ NOW() − 7d (warn at 24h) | 412 `roster_stale` |
| **G10** | Meta template is APPROVED | preflight `GET /v21.0/{WABA_ID}/message_templates?name=...&language=...` cached 15min; status === "APPROVED" | 503 `template_not_approved` |
| **G11** | No concurrent batch in flight | `WaBatch` row with `status="open"` and `kind="invite"` does not exist (unique index enforces) | 409 `batch_in_flight` |
| **G12** | UI uses typed-count confirmation | client-side; not enforced at endpoint but blocks the button | n/a |
| **G13** | Out-of-band notification fires before batch starts | `sendText` to `RICARDO_PHONE_E164` env: `"Convidar Todos disparado · 32 destinatários · dry-run: false"` | endpoint continues even if OOB fails (logs `OOB_NOTIFY_FAIL`) |

Defence in depth: G1 and G4 catch independent failure modes — G1 is "we're in the wrong build environment", G4 is "this build environment has the wrong URL." Either alone is enough to abort.

## Architecture overview

```
┌──────────────────────────────────────────────────────────────┐
│  /dashboard/wa/coverage  (client component)                  │
│                                                              │
│  WA group: ?…AbCdEf  [✓ Confirmo AbCdEf]                     │
│  Roster importado há 2h                                      │
│                                                              │
│  Faltam convidar (32)  [Convidar 32 pessoas]                 │
│    🧪 Testar: [phone input] [Enviar teste]                   │
│    ┌─ row · plan · phone · [badge: enviado 2d / falhou]      │
│    ...                                                        │
└────────────────┬─────────────────────────────────────────────┘
                 │ POST { force, dryRun }
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  POST /api/whatsapp/admin/group-invite/bulk                  │
│                                                              │
│  Preflight (any fail → abort):                               │
│    G1 VERCEL_ENV production                                  │
│    G2 WA_OUTBOUND_ENABLED                                    │
│    G3 invite URL regex                                       │
│    G4 invite URL fingerprint                                 │
│    G5 fingerprint confirmed this session                     │
│    G6 URL health check fresh                                 │
│    G9 roster age ≤ 7d                                        │
│    G10 Meta template APPROVED                                │
│    G11 no concurrent batch                                   │
│                                                              │
│  1. Acquire lock: insert WaBatch { kind:"invite", status:"open" } │
│  2. Re-derive recipients = computeCoverage().missingFromGroup │
│  3. Cap check: recipients ≤ WA_BULK_MAX                      │
│  4. OOB notify Ricardo (G13)                                 │
│  5. For each phone (sequential, 5min gap):                   │
│       ├─ pause flag check (DB)                               │
│       ├─ idempotency (30-day WaOutbound window)              │
│       ├─ sendTemplate(...) unless dryRun                     │
│       └─ WaOutbound + WaEvent + WaBatchItem                  │
│  6. Close batch: WaBatch.status = "done"                     │
│  7. Return { batchId, total, sent, skipped, failed, details }│
└──────────────────────────────────────────────────────────────┘
```

## Components

### Meta template (external, manual submission)

| Field | Value |
|---|---|
| Name | `convite_grupo_whatsapp` |
| Language | `pt_PT` |
| Category | **UTILITY first** (cost ~3-4× lower than MARKETING); fall back to MARKETING only if Meta rejects |
| Variables | `{{1}}` first name, `{{2}}` group invite URL |
| Body | See below |

**Template body:**

> Olá {{1}}! 👊
>
> Tens a tua subscrição activa na Striker's House e ainda não estás no nosso grupo de WhatsApp.
>
> Lá partilhamos horários, novidades da academia e fotos das aulas.
>
> Junta-te aqui: {{2}}
>
> Não vais querer perder!

Ricardo submits in Meta Business Manager → WhatsApp Manager → Message Templates → Create. Review ~24-48h.

### Environment variables

| Var | Where | Notes |
|-----|-------|-------|
| `WA_GROUP_INVITE_URL` | Vercel **Production only** | The active group invite link. Preview deployments must not set this. |
| `WA_OUTBOUND_ENABLED` | Vercel Production = `"true"`; Preview/dev = unset | G2 |
| `WA_BULK_MAX` | optional, default `100` | G8 |
| `RICARDO_PHONE_E164` | Vercel Production | Recipient of OOB notify (G13) |
| `WA_WABA_ID` | Vercel | For template-status preflight (G10) |
| `WA_ACCESS_TOKEN` | existing | Re-used for template-status call |

### Code-side constant

In `src/lib/wa/config.ts`:

```ts
// Last 6 chars of the prod group invite URL path. Changed only via PR review
// when the WhatsApp group admin rotates the link. Pairs with WA_GROUP_INVITE_URL
// for defence in depth (G4): even if env is misconfigured in prod, this catches it.
export const INVITE_URL_FINGERPRINT_PROD = "AbCdEf";  // placeholder — set on rollout

export function isOutboundEnabled(): boolean {
  return process.env.WA_OUTBOUND_ENABLED === "true";
}
```

### Database additions

```prisma
model WaGroupMember {
  // existing fields...
  archivedAt DateTime?  // soft-delete, see G-roster-safety below
  @@index([archivedAt])  // findMany filters archivedAt: null
}

model WaBatch {
  id          String    @id @default(cuid())
  kind        String    // "invite"
  status      String    // "open" | "done" | "aborted" | "paused"
  startedAt   DateTime  @default(now())
  finishedAt  DateTime?
  pausedAt    DateTime?
  triggeredBy String?   // session id or admin label
  recipients  Int       // count derived at batch start
  items       WaBatchItem[]

  @@unique([kind, status])  // G11: at most one open batch of each kind
}

model WaBatchItem {
  id         String   @id @default(cuid())
  batchId    String
  phoneE164  String
  outcome    String   // "pending" | "sent" | "skipped" | "failed" | "dry"
  reason     String?
  processedAt DateTime?
  batch      WaBatch  @relation(fields: [batchId], references: [id])

  @@unique([batchId, phoneE164])
  @@index([batchId, outcome])
}

model WaSetting {
  key       String   @id   // e.g. "fingerprint_confirmed_by_<sessionKey>"
  value     String         // ISO timestamp of confirmation
  updatedAt DateTime @updatedAt
}
```

### Endpoint: `POST /api/whatsapp/admin/group-invite/bulk`

**Auth:** admin-only via `getSession()`.

**Request body:**
```ts
{
  force?: boolean;   // bypass 30-day idempotency
  dryRun?: boolean;  // skip Meta API calls; just plan
}
```
Any other top-level keys → 400 `unexpected_recipient_field` (G7). Defence-in-depth: even an old client calling with `phoneE164s` is rejected.

**Response:**
```ts
{
  batchId: string;
  total: number;
  sent: number;
  skipped: number;
  failed: number;
  details: Array<{
    phoneE164: string;
    outcome: "sent" | "skipped" | "failed" | "dry";
    reason?: string;
    metaStatus?: number;
    metaError?: string;
  }>;
}
```

**Algorithm (with guard rails inline):**

1. `await getSession()` → admin or 403.
2. Run preflight gate (each failure returns the specific error code):
   - G1 `VERCEL_ENV === "production"`
   - G2 `isOutboundEnabled()`
   - G3 regex `WA_GROUP_INVITE_URL`
   - G4 `WA_GROUP_INVITE_URL.endsWith(INVITE_URL_FINGERPRINT_PROD)`
   - G5 read `WaSetting` for `fingerprint_confirmed_by_<sessionKey>` → must exist within 24h
   - G6 read most recent `WaEvent` of kind `INVITE_URL_OK` → must be ≤ 24h
   - G9 read `max(WaGroupMember.importedAt)` → must be ≥ NOW − 7d
   - G10 preflight Meta template status (cached 15min in `WaEvent kind="TEMPLATE_STATUS_OK"`)
3. Acquire lock (G11): `db.waBatch.create({ data: { kind: "invite", status: "open", recipients: 0 } })`. On unique-constraint conflict → 409 `batch_in_flight`.
4. Re-derive recipients server-side: `const report = await computeCoverage(); const recipients = report.missingFromGroup`. Update `WaBatch.recipients = recipients.length`.
5. Cap (G8): `if (recipients.length > Number(process.env.WA_BULK_MAX ?? 100))` → abort batch (`status="aborted"`), return 400.
6. Build a `phoneE164 → displayName` map via `fetchAllYogoCustomers()` (single fetch). Fallback name: `"amigo"`.
7. Out-of-band notify Ricardo (G13): `sendText(RICARDO_PHONE_E164, ...)`. On failure log `OOB_NOTIFY_FAIL` but continue (notification is informational).
8. For each recipient (sequential, 5-minute gap — randomized 3-7min):
   - Check `WaBatch.status === "paused"` → break loop; leave batch status="paused" for resume.
   - Idempotency: query existing `WaOutbound` row for `(phoneE164, "grp_invite")`. If `sentAt > NOW − 30d` and `!force` → outcome `skipped`, reason `recently_invited_<N>_days`.
   - Dry-run: outcome `dry`, no DB writes for WaOutbound, no Meta call.
   - Real send: delete existing WaOutbound row → call `sendTemplate(phone, "convite_grupo_whatsapp", "pt_PT", [name, url])` → insert new WaOutbound + WaEvent.
   - Write `WaBatchItem { batchId, phoneE164, outcome, reason, processedAt: NOW }`.
9. Close batch: `WaBatch.status = "done"` (or `"aborted"` if cap exceeded). Set `finishedAt`.
10. Return summary.

### UI changes in `/dashboard/wa/coverage/page.tsx`

**Header strip (above buckets):**
```
WA group: chat.whatsapp.com/…AbCdEf  [✓ Confirmo "AbCdEf" para hoje]
Roster importado há 2h         · health URL: ok há 4h
```
- The fingerprint comes from a new `GET /api/whatsapp/admin/invite-url-fingerprint` endpoint (returns the last 6 chars; server-side only).
- Clicking "Confirmo" calls `POST /api/whatsapp/admin/invite-url-confirm` which writes `WaSetting { key: "fingerprint_confirmed_by_<sessionKey>", value: NOW }` (G5).
- The roster-age badge turns amber > 24h and red > 7d (G9).
- The URL-health badge turns red if the latest `INVITE_URL_OK` event is > 24h (G6).

**Faltam convidar section:**
```
Faltam convidar (32)   [Convidar 32 pessoas]
🧪 Testar:  [phone input              ] [Enviar teste]
```
- Button label encodes the count (G12). Disabled if any G5/G6/G9 fail.
- Click → modal: `"Vais enviar template a 32 pessoas. Escreve 32 abaixo para confirmar."` + input + `□ Forçar re-envio (bypassa janela de 30d)` + `□ Dry-run`.
- Modal stays open while the batch runs, polling `GET /api/whatsapp/admin/group-invite/bulk/{batchId}` every 3s to update progress: `15/32 · 12 enviados · 2 saltados · 1 falhou`. **Pause** button calls `POST .../pause`.
- After completion: toast + per-row badge derived from latest `WaOutbound` row.

### Roster import safety (extending `/api/whatsapp/admin/group-members/import`)

To address Finding 4:

1. Add `archivedAt DateTime?` to `WaGroupMember` (soft-delete).
2. Change `deleteMany` to `updateMany({ where: { phoneE164: { notIn: keep } }, data: { archivedAt: NOW } })`.
3. Threshold guard: if `parsed.rows.length < currentNonArchivedCount * 0.5` and `!body.confirmReplace` → return 412 `large_delete_requires_confirmReplace` with `{ currentCount, proposedCount, diff }`.
4. UI on the coverage page surfaces the diff in the import-CSV result with a `[Confirmar substituição]` button that re-submits with `confirmReplace: true`.
5. Restore endpoint: `POST /api/whatsapp/admin/group-members/restore { phoneE164s }` flips `archivedAt = null` for the listed rows. Auto-restore via a cron is out of scope.

## Data flow

1. Page loads → `GET /api/whatsapp/admin/group-coverage` returns each `missingFromGroup` entry decorated with `lastInvite: { sentAt, status, error? } | null` + `latestBatch: { id, status, recipients, sent, skipped, failed }`.
2. Operator confirms fingerprint (G5).
3. Operator clicks **Convidar 32 pessoas** → typed-count modal → `POST .../bulk { force, dryRun }`.
4. Server runs G1-G10 preflight → 409/423/etc. on any fail.
5. Acquire lock → derive recipients → OOB notify → sequential send (5min gap) → batch close.
6. UI polls batch progress; updates per-row badges from `WaOutbound` after completion.

## Error handling

| Scenario | Behaviour |
|---|---|
| Any preflight fails (G1–G10) | Endpoint returns the specific error code BEFORE any send. UI shows actionable banner ("Confirma fingerprint", "Re-importa roster", etc.). |
| Lock conflict (G11) | 409 `batch_in_flight`. UI surfaces the existing batch id and links to its status. |
| Cap exceeded (G8) | Batch row created then aborted (status="aborted") to leave audit; 400 returned. |
| Template not approved (Meta 400 132xxx, post-preflight race) | Outcome `failed`, reason `template_pending`; batch continues; WaEvent `TEMPLATE_PENDING`. |
| Phone invalid for WhatsApp (Meta 400 131026) | Outcome `failed`, reason `invalid_recipient`; batch continues. |
| `WA_ACCESS_TOKEN` 401/403 from Meta | Batch aborts: status="aborted", reason="wa_auth_fail"; UI red banner. |
| Rate limit 429 | One 5s backoff + retry; if still fails, outcome `failed` reason `rate_limited`; batch continues. |
| `WA_GROUP_INVITE_URL` missing | Caught by G3 regex. |
| Test phone not in Yogo | Name falls back to `"amigo"`; send proceeds; UI surfaces this in the detail row. |
| OOB notify (G13) fails | Log `OOB_NOTIFY_FAIL`, continue batch. The notification is informational. |
| Operator clicks Pause mid-batch | Loop checks `WaBatch.status === "paused"` between sends; sets `pausedAt`, stops gracefully. Resume button re-enters the loop using `WaBatchItem.outcome="pending"` rows. |

## Idempotency model

- `WaOutbound` keeps `@@unique([phoneE164, templateKey])` — the last attempt per template per phone.
- `templateKey = "grp_invite"`. Re-sends overwrite the prior row.
- The 30-day skip rule is enforced in code by reading the existing row's `sentAt`.
- `WaBatchItem` records every attempted recipient per batch (`@@unique([batchId, phoneE164])`). This is the full audit trail; `WaOutbound` is the "most recent state per recipient" view.
- `WaBatch` unique constraint on `(kind, status="open")` is the cross-batch lock (G11).

## Testing strategy

| Layer | Test |
|---|---|
| Unit | `idempotencyAllows(now, lastSent, force)` table: 3d ago / 31d ago / null / force=true. |
| Unit | `validateInviteUrl(url, fingerprint)` table: matching, regex-only-pass, regex-fail. |
| Unit | `acquireBatchLock` simulates concurrent inserts → exactly one succeeds. |
| Unit | Roster threshold: 5% replace blocks without `confirmReplace`; 60% replace passes. |
| Integration | Endpoint with `dryRun: true` — verifies preflight gates run in order, recipients derived, no sends fire. |
| Integration | All 11 preflight failure paths each return the expected error code with no side effects (no batch row, no sends, no OOB). |
| Integration | Pause → resume → continues from last pending `WaBatchItem`. |
| Manual (dev) | `Enviar teste` to +351912873698 — confirm template arrives, WaOutbound + WaEvent + WaBatchItem written. |
| Manual (prod cutover) | 3-5 names via Enviar teste one-by-one before any bulk. |
| Manual (post-deploy) | First bulk: `dryRun=true` confirms recipients + planning; second bulk: real send with all G-checks green. |

## Rollout

1. **Day 0:** Ricardo generates group invite link in WhatsApp (Settings → Invite via link); sets `WA_GROUP_INVITE_URL`, `WA_OUTBOUND_ENABLED=true`, `RICARDO_PHONE_E164`, `WA_WABA_ID` in Vercel **Production only**. Updates `INVITE_URL_FINGERPRINT_PROD` constant in `lib/wa/config.ts` with the real last-6-chars and ships a PR.
2. **Day 0:** Ricardo submits Meta template `convite_grupo_whatsapp` (UTILITY) for review.
3. **Day 0:** Implement endpoint + UI + DB migration. Ship to preview. Preview deploy will fail G1 + G2 by design.
4. **Day 0:** Schedule URL health-check cron (every 6h): `HEAD WA_GROUP_INVITE_URL` → log `INVITE_URL_OK` or `INVITE_URL_DEAD`.
5. **Day 1-2:** Wait for Meta approval. Once APPROVED, run `Enviar teste` to Ricardo's phone in prod.
6. **Day 2+:** Operator confirms fingerprint → first bulk with `dryRun=true` → review planned recipients → second bulk for real.
7. **Day 2+:** Monitor `/dashboard/wa` for `TEMPLATE_FAIL`, `OOB_NOTIFY_FAIL`, batch failures. Re-Resync coverage after a day to see "covered" count tick up.

## Open dependencies

- Meta template approval (external, 24-48h).
- Group invite link generated and `INVITE_URL_FINGERPRINT_PROD` set via PR.
- `WA_OUTBOUND_ENABLED=true` in Vercel Production env.
- URL health-check cron exists or is added.

## Related work (parallel stream)

Several guard-rail findings target **existing** code paths that pre-date this feature (`scripts/migrate-turso.mjs`, `src/app/api/whatsapp/admin/group-members/import/route.ts`, `src/lib/wa/config.ts`). Those fixes are documented separately at `predict/260527-0001-wa-group-invite-guardrails/handoff-fix-existing.md` and should be sequenced before — or in parallel with — the new feature work. The new feature spec assumes some of those fixes are landed (specifically: `archivedAt` column on WaGroupMember, `isOutboundEnabled()` helper, `INVITE_URL_FINGERPRINT_PROD` constant).
