---
title: WhatsApp group invite — bulk send from coverage page
type: design
date: 2026-05-27
status: approved
---

# WhatsApp group invite — bulk send

## Why this exists

The `/dashboard/wa/coverage` page now lists 32 active recurring subscribers who pay for the gym but are not in the official WhatsApp group. Marcelo wants to invite all of them in one go without leaving the dashboard, without manually copy-pasting the group link 32 times, and without accidentally re-inviting people he already invited.

WhatsApp Cloud API does not allow adding members to a group programmatically (Meta blocks that for privacy). The closest legal mechanism is sending each missing subscriber a pre-approved **template message** containing the group invite link.

## Goal & scope

- Send a Meta-approved template message containing the group invite link to every phone in the "Faltam convidar" bucket.
- Surface results inline on the coverage page (sent / skipped / failed).
- Make the action safe to re-run: skip anyone invited in the last 30 days unless the operator explicitly forces a re-send.
- Provide a single-recipient test channel so the operator can dry-run on their own number before blasting the cohort.

**Out of scope this iteration:**
- Ex-clients win-back flow (separate feature)
- Group cleanup of "Desconhecidos no grupo" (separate feature)
- Detecting who actually joined the group after the invite (WhatsApp Cloud API does not emit a join event; rely on the next coverage Resync to observe the diff)

## Architecture overview

```
┌──────────────────────────────────────────────────────────────┐
│  /dashboard/wa/coverage  (client component)                  │
│                                                              │
│  Faltam convidar (32) [Convidar todos]                       │
│    🧪 Testar: [phone input] [Enviar teste]                   │
│    ┌─ row · plan · phone · [badge: enviado 2d / falhou]      │
│    ...                                                        │
└────────────────┬─────────────────────────────────────────────┘
                 │ POST { phoneE164s, force, dryRun? }
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  POST /api/whatsapp/admin/group-invite/bulk                   │
│                                                              │
│  1. Auth: getSession() === "admin" or 403                    │
│  2. Validate input (each phone is E.164)                     │
│  3. Read WA_GROUP_INVITE_URL from env or 500                 │
│  4. Batch-lookup names from Yogo (one fetch up front)        │
│  5. For each phone, sequentially (200ms gap):                │
│       - 30-day idempotency check on WaOutbound               │
│       - sendTemplate("convite_grupo_whatsapp", pt_PT, [n,l]) │
│       - Persist WaOutbound + WaEvent                         │
│  6. Return summary { total, sent, skipped, failed, details } │
└──────────────────────────────────────────────────────────────┘
```

## Components

### Meta template (external, manual submission)

| Field | Value |
|---|---|
| Name | `convite_grupo_whatsapp` |
| Language | `pt_PT` |
| Category | MARKETING |
| Variables | `{{1}}` first name, `{{2}}` group invite URL |
| Body | See "Template body" below |

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

Ricardo submits this in Meta Business Manager → WhatsApp Manager → Message Templates → Create Template. Review takes ~24-48h.

### Environment variable

`WA_GROUP_INVITE_URL` — the group invite link (e.g. `https://chat.whatsapp.com/XXXXXXXXX`). Set in `.env.local` for dev, and in Vercel env for Preview + Production. Rotated only when the WhatsApp group admin regenerates the link.

### Endpoint: `POST /api/whatsapp/admin/group-invite/bulk`

**Auth:** admin-only via `getSession()`.

**Request body:**
```ts
{
  phoneE164s: string[];   // each starting with "+"
  force?: boolean;        // bypass 30-day idempotency
  dryRun?: boolean;       // skip the Meta API call; just report what would happen
}
```

**Response:**
```ts
{
  total: number;
  sent: number;
  skipped: number;        // skipped by 30-day window
  failed: number;
  details: Array<{
    phoneE164: string;
    outcome: "sent" | "skipped" | "failed" | "dry";
    reason?: string;       // for skipped/failed
    metaStatus?: number;
    metaError?: string;
  }>;
}
```

**Algorithm:**
1. Validate `phoneE164s` is a non-empty array of E.164-format strings.
2. Read `WA_GROUP_INVITE_URL`; return 500 `missing_invite_url` if absent.
3. Call `fetchAllYogoCustomers()` once and build a `phoneE164 → displayName` map (use all variants from `normalize()`).
4. For each input phone:
   - Look up name in the map. Fallback: `"amigo"`.
   - **Idempotency:** query `WaOutbound` for the most recent row where `phoneE164 = ?` and `templateKey = "grp_invite"`. If `sentAt > NOW() - 30d` and `!force`, mark `skipped` with reason `recently_invited_<N>_days`; continue.
   - **Dry-run:** if `dryRun`, record outcome `dry` and continue; don't touch WaOutbound or call Meta.
   - **Delete the existing WaOutbound row** for `(phoneE164, "grp_invite")` to satisfy the `@@unique(phoneE164, templateKey)` constraint (the unique key means we keep the most recent attempt only).
   - Call `sendTemplate(phone, "convite_grupo_whatsapp", "pt_PT", [{type:"text",text:name},{type:"text",text:url}])`.
   - **On success:** insert `WaOutbound { templateKey: "grp_invite", kind: "template", status: "sent", payload: JSON.stringify({name, url}) }` and `WaEvent { kind: "GROUP_INVITE_SENT" }`.
   - **On failure:** insert `WaOutbound` with `status: "failed"` and `error`; insert `WaEvent { kind: "GROUP_INVITE_FAIL", meta: { metaStatus, metaError }}`. If the Meta error code is 132xxx (template pending), set status `"pending"` and event kind `"TEMPLATE_PENDING"`.
   - Sleep 200ms between iterations to stay below WhatsApp's per-number throughput.
5. Return the summary.

### UI changes in `/dashboard/wa/coverage/page.tsx`

In the **Faltam convidar** section header:

```
Faltam convidar (32) [Convidar todos]
🧪 Testar:  [phone input              ] [Enviar teste]
```

- The **Convidar todos** button shows a confirmation prompt: *"Enviar template a 32 pessoas? Quem foi convidado nos últimos 30d será saltado."* with a `□ Forçar re-envio` checkbox. On submit, calls the endpoint with the full list of phones from `missingFromGroup`.
- The **Enviar teste** input accepts a single phone in human form; client-side normalises with the same `normalize()` helper; calls the endpoint with `phoneE164s: [normalized]` and surfaces the full `details` row inline (including any Meta error).
- After bulk completes, the section renders a result toast (`✓ 28 enviados · 4 saltados · 0 falharam`) and each row gains a badge: `· enviado 2d` (with date tooltip) or `· falhou` (red, clickable to see the error from `WaOutbound.error`).
- Per-row badge state is derived from the latest `WaOutbound` row with `templateKey="grp_invite"` for that phone. The coverage endpoint is extended to include this field per `missingFromGroup` entry.

## Data flow

1. Page loads → `GET /api/whatsapp/admin/group-coverage` returns each `missingFromGroup` entry decorated with `lastInvite: { sentAt, status, error? } | null`.
2. Admin clicks **Convidar todos** → confirm → `POST .../group-invite/bulk { phoneE164s, force }`.
3. Endpoint iterates, persists `WaOutbound` + `WaEvent` per phone, returns summary.
4. UI shows summary toast; calls Resync (the existing `GET .../group-coverage`) to refresh badges.

## Error handling

| Scenario | Behaviour |
|---|---|
| Template not yet approved (Meta 400 132xxx) | Outcome `failed`, reason `template_pending`; WaEvent `TEMPLATE_PENDING`; batch continues |
| Phone invalid for WhatsApp (Meta 400 131026 or similar) | Outcome `failed`, reason `invalid_recipient`; batch continues |
| `WA_ACCESS_TOKEN` expired/invalid (401/403 from Meta) | Outcome `failed`, reason `wa_auth_fail`; **batch aborts** so we don't burn through the list — surface in UI as a red banner |
| Rate limited (429) | One backoff of 1s + retry; if still fails, mark `failed` with reason `rate_limited` |
| `WA_GROUP_INVITE_URL` missing | Endpoint returns 500 `missing_invite_url`; UI shows actionable banner |
| Test phone not in Yogo | Name falls back to `"amigo"`; send proceeds; UI surfaces this in the detail row |
| Operator force-resend within 30d | Bypasses idempotency, still recorded in WaOutbound |

## Idempotency model

- `WaOutbound` already has `@@unique([phoneE164, templateKey])`, so only one row per (phone, template) survives.
- We use `templateKey = "grp_invite"` (no versioning). Re-sends overwrite the prior row.
- The 30-day skip rule is enforced **in code** by reading the existing row's `sentAt` before deciding to send.
- This makes the audit trail "the last invite attempt" rather than "every invite attempt ever". Trade-off: we lose historical resend counts, but we keep the table tidy and the unique constraint sane. If audit history is needed later, `WaEvent` already keeps an append-only log per send.

## Testing strategy

| Layer | Test |
|---|---|
| Unit | `idempotencyAllows(now, lastSent, force)` — table of (3d ago / 31d ago / null / force=true) cases |
| Unit | Template parameter formatting (verify `{type:"text",text}` shape, escapes braces in names) |
| Integration | Endpoint with `dryRun: true` — verifies the planning loop without hitting Meta; assert `details` shape and idempotency decisions |
| Manual (dev) | `Enviar teste` to +351912873698 (Ricardo) — confirm template arrives, `WaOutbound` + `WaEvent` written |
| Manual (prod cutover) | First click: pick 3-5 names from the missing list via the test input one-by-one; verify before bulk |
| Manual (post-deploy) | Hit **Convidar todos**; observe summary; confirm Marcelo's phone receives nothing (he's already in the group, so not in missing) |

## Rollout

1. **Day 0:** Ricardo submits the Meta template `convite_grupo_whatsapp` for review. Sets `WA_GROUP_INVITE_URL` in Vercel (preview + production).
2. **Day 0:** Implement endpoint + UI behind no flag. Ship to preview deployment.
3. **Day 0:** Run `dryRun: true` against the 32 missing — verify the planning loop works (names resolved, idempotency clean).
4. **Day 1-2:** Wait for Meta approval. Once approved, `Enviar teste` to Ricardo's phone end-to-end. Confirm receipt, badge, audit.
5. **Day 2+:** Bulk send. Monitor `/dashboard/wa` for `TEMPLATE_FAIL` events. Re-Resync coverage after a day to see the "covered" count tick up.

## Open dependencies

- **Meta template approval** — external to us, 24-48h.
- **Group invite link** — Ricardo must generate once in WhatsApp app (Settings → Invite via link → Copy) and set `WA_GROUP_INVITE_URL` in Vercel.
- **`WA_ACCESS_TOKEN`** — already in use by the bot; no rotation needed for this feature.
