---
title: WhatsApp Bot — Pending
type: todo
date: 2026-05-26
status: open
related: [[WhatsApp-Bot-v1-Spec]], [[Roadmap]], [[Gotchas]]
---

# WhatsApp Bot — Pending

After Slice 0–6 shipped, menu redesign live, and end-to-end smoke confirmed on prod (2026-05-26). These are the open follow-ups, in rough priority order.

## 🔴 Operational risk (do soonish)

- [ ] **Rotate the leaked `WA_ACCESS_TOKEN`**. The System User token starting `EAAic5AyXmZAwBRg91W…` was pasted in chat during setup. Meta Business → System Users → revoke + generate fresh + update Vercel env (production / preview / development).
- [ ] **Submit the `trial_followup_pt` template** in Meta WhatsApp Manager (the G3 gate). Until approved, \`/api/cron/trial-followup\` logs \`TEMPLATE_PENDING\` and no-ops. Lead time 24–48h for Meta approval.

## 🟡 Quality / UX improvements (do when next touching the bot)

- [ ] **Fix LOOKUP_MISS empty-cache bug** in \`src/lib/yogo/lookup.ts\`. If a Yogo fetch returns 0 customers (transient error / rate limit), we cache the empty map for 60s and reject every lookup. Fix: don't cache empty results. 3-line change. Triggered the LOOKUP_MISS we saw at 14:38 UTC today before recovering at 14:40.
- [ ] **\`/dashboard/wa\` redesign** per the saved plan at \`docs/superpowers/plans/2026-05-26-dashboard-wa-redesign.md\`. Replace the current over-engineered admin page with: KPI strip (bookings/cancels today + 7d, unique students, failure rate), conversations grouped by phone, failures-only feed. Removes the "Repor" button. ~300 LOC.

## 🟢 Growth (when you want to expand)

- [ ] **Publish the Meta app** so non-test-recipient customers (real alunos, not just registered test phones) can message the bot. Currently in development mode → only registered test phones get replies.
- [ ] **\`minhas\` / \`plano\` commands** mentioned in original v1 spec but deferred — show user's upcoming class count / membership status. Likely as new menu buttons or sub-options.

## 🔵 Hygiene

- [x] **Marcelo phone in Yogo** — added 351 968873843 to customer \`1168560\` (2026-05-26).
- [ ] **Marcelo phone added to Meta test recipients** — still needed before he can receive bot replies.

## Reference docs (canonical, do not edit lightly)

- Spec: \`docs/superpowers/specs/2026-05-25-whatsapp-bot-v1-design.md\`
- Menu redesign spec: \`docs/superpowers/specs/2026-05-26-wa-menu-flow-design.md\`
- Menu redesign plan: \`docs/superpowers/plans/2026-05-26-wa-menu-flow-implementation.md\`
- Dashboard /wa redesign plan: \`docs/superpowers/plans/2026-05-26-dashboard-wa-redesign.md\`
- Runbook: \`docs/superpowers/runbooks/whatsapp-bot.md\`

## Smoke proof

Manual end-to-end on 2026-05-26 from \`+351 912 873 698\`:

| Time (UTC) | Event |
|---|---|
| 14:40:20 | BOOKING_OK via menu (btn_reservar → list_pick → confirm_book) |
| 14:43:22 | CANCEL_OK via menu (btn_agenda → list_pick → confirm_cancel) |

Bot is live + working.