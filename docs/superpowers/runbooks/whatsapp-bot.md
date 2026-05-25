---
title: WhatsApp Bot — Runbook
date: 2026-05-25
status: live
audience: Marcelo (ops), Ricardo (dev)
---

# WhatsApp Bot — Runbook

Operational reference for the WA bot v1. Keep open in a tab when something feels off.

## Kill switch (when the bot is misbehaving)

The webhook honours `WA_ENABLED`. Anything except the literal string `"false"` keeps it on.

| Action | Command |
|---|---|
| Pause the bot in prod | `vercel env add WA_ENABLED production` → value `false`, then `vercel deploy --prod` |
| Pause locally | edit `.env.local` → `WA_ENABLED=false`, restart dev server |
| Resume | set `WA_ENABLED=true` (or remove the var) and redeploy |
| Verify pause | dashboard shows an amber bar "⏸ Bot WhatsApp pausado" at the top |

When paused, the webhook responds `200 {ack:true, disabled:true}` instantly. Meta keeps delivering, the bot stays silent, and no `WaInbound` / `WaEvent` rows are written. Customers get no reply.

## `/api/whatsapp/health` (admin-only)

```bash
curl https://<prod>/api/whatsapp/health -b "striker_session=admin"
```

Sample response:

```json
{
  "enabled": true,
  "generatedAt": "2026-05-25T22:00:00.000Z",
  "last24h": {
    "eventsByKind": { "BOOKING_OK": 12, "LOOKUP_MISS": 2, "HMAC_FAIL": 0 },
    "outboundFailed": 0
  },
  "sessions": { "active": 3, "expired": 41 }
}
```

What to look at when something feels wrong:

- `eventsByKind.HMAC_FAIL > 0` → either someone is probing the webhook OR the `WA_APP_SECRET` env is stale (Meta rotated it). Compare against Meta Developers → App Settings → Basic.
- `eventsByKind.LOOKUP_MISS` growing fast → customer phones aren't normalising. Run `npm run phone:spike` to refresh the gate measurement.
- `outboundFailed > 0` → `sendText` is failing. Likely `WA_ACCESS_TOKEN` expired (System User tokens shouldn't, but check) or the recipient is on Meta's 24h messaging window restriction.
- `sessions.expired` huge and growing → harmless; expired sessions accumulate until the next dev cleanup. Add a daily purge later if it gets noisy.

## WaEvent kinds — meaning + first action

| Kind | What happened | First diagnostic |
|---|---|---|
| `HMAC_FAIL` | Webhook got a request with a bad signature | Confirm `WA_APP_SECRET` matches Meta. |
| `LOOKUP_MISS` | Inbound from a phone that doesn't match any Yogo customer | Search Yogo manually by name/email; fix the customer's `phone` field to canonical `+351…`. |
| `SESSION_RACE` | Two inbounds for the same phone hit at once; one lost the optimistic-lock race | Usually self-corrects (Meta re-sends nothing — the user can just tap again). |
| `BOOKING_OK` | Yogo `POST /class-signups` returned 200 | No action — happy path. |
| `BOOKING_FAIL` | Yogo returned 5xx on signup attempt | Check Yogo dashboard for the class; retry manually if needed. |
| `CANCEL_OK` | Yogo `DELETE /class-signups/{id}` returned 200 | Happy path. |
| `CANCEL_FAIL` | DELETE failed | Often the signup was already cancelled; check Yogo. |
| `TEMPLATE_PENDING` | Cron tried to send a template that Meta hasn't approved yet | Submit / re-submit in Meta Manager → Message Templates. |
| `YOGO_401` | Yogo rejected our token | Refresh `YOGO_TOKEN`. JWT expires every 180 days; current one runs to Oct 2026. |

## Common queries (sqlite locally / libsql in prod — same SQL)

```sql
-- Last 24h activity per kind
SELECT kind, COUNT(*)
FROM WaEvent
WHERE createdAt > datetime('now', '-1 day')
GROUP BY kind;

-- Recent LOOKUP_MISS phones (numbers that messaged but didn't match)
SELECT phoneE164, createdAt, meta
FROM WaEvent
WHERE kind = 'LOOKUP_MISS' AND createdAt > datetime('now', '-7 day')
ORDER BY createdAt DESC;

-- Stuck sessions (TTL way past — bug?)
SELECT phoneE164, state, expiresAt
FROM WaSession
WHERE expiresAt < datetime('now', '-1 day')
ORDER BY expiresAt;

-- Recent outbound failures
SELECT phoneE164, kind, error, sentAt
FROM WaOutbound
WHERE status = 'failed' AND sentAt > datetime('now', '-1 day')
ORDER BY sentAt DESC;

-- All messages from one phone (operational lookup)
SELECT body, receivedAt
FROM WaInbound
WHERE phoneE164 = '+351912345678'
ORDER BY receivedAt DESC
LIMIT 20;
```

## End-to-end smoke (after a deploy)

1. From a phone whose number is in Yogo, message the bot any text.
2. Check `/api/whatsapp/health` — `last24h.eventsByKind` should tick.
3. If the bot replies "echo: …" (current Slice 2 behaviour), the pipeline is live.
4. Once Slice 3 lands, replace step 3 with: send `reserva` → expect class list.

## Escalation

- HMAC failures climbing fast or unknown phones spamming → flip the kill switch immediately, investigate later.
- Yogo down → bot will surface `BOOKING_FAIL` / `CANCEL_FAIL`; no action required from us beyond waiting for Yogo recovery.
- Meta down (rare) → bot replies fail silently; users get no answer. Nothing to do but wait.

## Future bot lives where

- Spec: [`../specs/2026-05-25-whatsapp-bot-v1-design.md`](../specs/2026-05-25-whatsapp-bot-v1-design.md)
- Phone normaliser: `src/lib/phone.ts` + `tests/lib/phone.test.ts` + spike at `tests/spike/phone-normalisation.test.ts` (`npm run phone:spike`)
- Webhook: `src/app/api/whatsapp/webhook/route.ts`
- Health: `src/app/api/whatsapp/health/route.ts`
- Kill switch helper: `src/lib/wa/config.ts`
