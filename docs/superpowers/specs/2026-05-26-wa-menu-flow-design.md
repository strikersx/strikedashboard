---
title: WA Bot — Menu-led entry flow + 2h cancel cutoff
date: 2026-05-26
author: claude
status: approved
supersedes-keywords: reserva/reservar/marcar/agendar/cancelar/cancela/desmarcar
implementation-pr: TBD (next session)
---

# WA Bot — Menu-led entry flow

## 1. Goal

Replace the keyword-only entry with a 3-button interactive menu so alunos don't need to memorize `reserva` / `cancelar`. Any text from a student in IDLE state now triggers a menu of **Reservar / Minha agenda / Outros**. Same redesign brings the cancel cutoff from 15min to 2h.

## 2. Non-goals

- No new database schema. WaSession state machine stays 5 states.
- No cooldown / anti-spam on the menu. If aluno spams text, they get spammed menus. Acceptable; revisit if it bothers anyone.
- No removal of keyword *matching* — typing `reserva` is just text, the same code path. Keywords don't have a privileged route anymore.
- No agenda view beyond the picker (no "calendar UI", just the cancellation picker labeled as agenda).
- No "needs human" flag. "Outros" routes alunos to humanly-monitored conversation — Marcelo sees inbound text via Meta Business Suite app.

## 3. State machine (approach A — no new state)

```
estado            | input                  | acção
------------------|------------------------|----------------------------------------
IDLE              | text (any)             | sendMenu()                    (stays IDLE)
IDLE              | button btn_reservar    | handleReservar()              (→ AWAIT_CLASS_PICK)
IDLE              | button btn_agenda      | handleCancelar()              (→ AWAIT_CANCEL_PICK / AWAIT_CONFIRM_CANCEL)
IDLE              | button btn_outros      | sendText(OUTROS_MSG)          (stays IDLE)

AWAIT_*           | text (any)             | resetToIdle() + sendMenu()
AWAIT_*           | button btn_*           | resetToIdle() + dispatch button as IDLE
AWAIT_*           | list_pick / flow btn   | existing handler              (unchanged)
```

Keywords (`reserva`, `cancelar`, etc.) no longer have privileged routing — they are plain text and hit the menu path. The `parseIntent` keyword regexes can be removed (or kept harmlessly; they classify but nothing reads `kind: "reservar"` anymore — cleanup task).

`handleFallback` becomes dead code. Delete.

## 4. Menu payload

WhatsApp `interactive.button` payload (max 3 buttons, title ≤20c each):

```
body.text: "Olá! O que precisas?"
buttons:
  - { id: "btn_reservar", title: "Reservar" }
  - { id: "btn_agenda",   title: "Minha agenda" }
  - { id: "btn_outros",   title: "Outros" }
```

Outros text (verbatim, user-chosen wording):

> `Entre em contato com o número de atendimento.`

(No number embedded. Aluno is already in chat with the bot's number — they just write what they need; Marcelo reads via Meta Business Suite.)

## 5. "Minha agenda" — detailed flow

1. `findCustomerByPhone(phoneE164)` — miss → log `LOOKUP_MISS` + send fallback text (same as reservar today).
2. `listFutureSignups(customerId, today, +14d)` — bare query, no cutoff filter at this stage.
3. Compute `cancellable: boolean` per signup via `isCancellable(signup, now)` (2h cutoff — see §6).
4. `renderAgendaList(signups, now)`:
   - **0 signups** → text *"Não tens aulas marcadas."* (stay IDLE).
   - **>10 signups** → text *"Tens muitas marcações. Escreve a data e hora (DD/MM HH:MM) da aula a cancelar."* + transition `AWAIT_CANCEL_PICK` (free-text fallback, existing `handleCancelPickByText`).
   - **1..10 signups** → single-section list `PRÓXIMAS` with one row per signup:
     - Cancellable: `id=<signupId>`, title `"19:30 Striking"`, description `"qua 27/05"`
     - Locked (<2h, but still in the future): `id=<signupId>_locked`, title `"⏰ 19:30 Striking"`, description `"em breve · não cancelável"`
   - Past signups are filtered out before reaching the renderer.
5. Aluno taps a row → `handleCancelPick(session, id)`:
   - If `id` ends in `_locked` → strip suffix, log nothing, send text *"Esta aula começa em menos de 2h. Não dá para cancelar."* — stay IDLE.
   - Else → transition `AWAIT_CONFIRM_CANCEL`, `pendingSignupId=<id>`, send `renderConfirmCancel` button.
6. Confirm "Sim, cancelar" → `DELETE /class-signups/{id}` → `CANCEL_OK` + *"Cancelado."* → reset IDLE.
7. Abort "Não" → *"Ok, mantenho a marcação."* → reset IDLE.

`renderAgendaList` replaces `renderCancelList`. Same purpose, new mixed-eligibility behaviour.

## 6. Cancel cutoff: 15min → 2h

Single constant change in `src/lib/yogo/signups.ts`:

```ts
const CANCEL_CUTOFF_MS = 2 * 60 * 60 * 1000;   // was 15 * 60 * 1000
```

Operational impact:
- Alunos can cancel up to 2h before class.
- Aulas starting in <2h appear locked in agenda; tapping returns the *"em menos de 2h"* text.
- Marcelo retains manual override via Yogo admin UI (no cutoff there).

Tests to update (`tests/lib/yogo/signups.test.ts`):
- *"rejects classes starting in <15min (cutoff)"* → rename to *"<2h"*, fixture now=`19:00`, class=`20:30` (1.5h, rejected).
- *"accepts classes starting exactly past the 15-min cutoff"* → rename to *"past the 2h cutoff"*, fixture now=`19:00`, class=`21:01` (2h01min, accepted).
- Other 4 cases unchanged (already-cancelled / unpopulated / far future / past).

Runbook: 3 references to "15min" → "2h" in `docs/superpowers/runbooks/whatsapp-bot.md`.

## 7. Files affected

**Create:**
| File | LOC |
|---|---|
| `src/lib/wa/handlers/menu.ts` — `sendMenu(phoneE164)`, `handleOutros(phoneE164)` | ~25 |

**Edit:**
| File | LOC delta |
|---|---|
| `src/lib/wa/render.ts` — add `renderMenu()`; replace `renderCancelList` with `renderAgendaList(signups, now)` | +60 −30 |
| `src/lib/wa/dispatch.ts` — IDLE+text → sendMenu; IDLE+button routes 3 IDs; mid-flow text → reset + sendMenu | +30 −15 |
| `src/lib/wa/handlers/cancelar.ts` — refactor to use `renderAgendaList`; add `_locked` suffix branch in `handleCancelPick` | +20 −10 |
| `src/lib/yogo/signups.ts` — `CANCEL_CUTOFF_MS = 2h` | +1 −1 |
| `src/lib/wa/config.ts` — remove `isCancelarEnabled()` (cancel always on now) | −3 |
| `.env.example` — remove `WA_FLOW_CANCELAR` line | −1 |
| `tests/lib/wa/render.test.ts` — 4 new cases (menu, agenda with locked, agenda empty, agenda >10) | +50 |
| `tests/lib/yogo/signups.test.ts` — update 2 cases (15min → 2h) | ±10 |
| `docs/superpowers/runbooks/whatsapp-bot.md` — 3 cutoff mentions | ±5 |

**Delete:**
| File | Why |
|---|---|
| `src/lib/wa/handlers/fallback.ts` | Replaced by sendMenu |

**Net total**: ~200 LOC added/changed.

## 8. Vercel env cleanup (post-merge)

```bash
vercel env rm WA_FLOW_CANCELAR production
vercel env rm WA_FLOW_CANCELAR preview
vercel env rm WA_FLOW_CANCELAR development
```

Cancel becomes always-on after this PR. No more flag.

## 9. Tests added/updated

| Behaviour | Test file | Type |
|---|---|---|
| `renderMenu()` produces 3 buttons with correct ids/titles | `render.test.ts` | unit |
| `renderAgendaList()` mixes locked + eligible rows correctly | `render.test.ts` | unit, fixture-driven |
| `renderAgendaList()` 0 signups → text fallback | `render.test.ts` | unit |
| `renderAgendaList()` >10 → free-text DD/MM HH:MM | `render.test.ts` | unit |
| `isCancellable` 2h cutoff (3 cases: rejected <2h, accepted just past, far future) | `signups.test.ts` | unit (update existing) |

No new tests for `dispatch.ts` — follows the existing pattern (dispatch tested via integration smoke, not unit).

## 10. Manual smoke after deploy

1. WhatsApp text "olá" (or any random) → see 3-button menu.
2. Tap **Reservar** → see today/tomorrow class list (existing reservar flow).
3. Tap **Minha agenda**:
   - With ≥1 booking >2h away → see list with row tappable.
   - With booking <2h away → row shows `⏰` prefix + *"em breve · não cancelável"*; tap → blocked message.
   - With 0 bookings → text *"Não tens aulas marcadas."*
4. Tap **Outros** → text *"Entre em contato com o número de atendimento."*
5. Mid-flow text test:
   - After **Reservar** tap, while list is open, type "olá" → menu appears, list is dead.
6. `WaEvent` table should show `BOOKING_OK` / `CANCEL_OK` as before; new flow doesn't introduce new event kinds.

## 11. Rollback

Revert the merge commit. Restore `WA_FLOW_CANCELAR=false` in Vercel (re-add). Cancel flow returns to flag-gated state, reservar continues working (its keywords are still text-matched in the regex but text-anything-shows-menu path is gone, so it falls back to keyword path automatically since `parseIntent` keywords still exist or we kept them as harmless classifiers).

If `parseIntent` regexes were *deleted* in this PR, rollback also needs a 2-line restore. Implementation should either keep them as dead code (zero-cost) or revert spec to spell out the parser change too. **Implementer decision: keep the regexes harmlessly so rollback is a single revert.**

## 12. Open questions

None. All resolved in the brainstorm:
- Trigger: any text in IDLE → menu (no first-message-only behaviour).
- Mid-flow: text resets + menu.
- Agenda scope: all future, mixed eligibility.
- Outros wording: literal user text.
- Cutoff: 2h, in this PR.
- State: approach A (no new state).
- WA_FLOW_CANCELAR: removed (cancel always on).

## 13. Cross-references

- Previous spec: [`docs/superpowers/specs/2026-05-25-whatsapp-bot-v1-design.md`](2026-05-25-whatsapp-bot-v1-design.md) — bot v1 design that this menu flow modifies.
- Runbook: [`docs/superpowers/runbooks/whatsapp-bot.md`](../runbooks/whatsapp-bot.md) — needs cutoff text updates.
- Plan (separate concern): [`docs/superpowers/plans/2026-05-26-dashboard-wa-redesign.md`](../plans/2026-05-26-dashboard-wa-redesign.md) — dashboard redesign, independent of this menu flow.
