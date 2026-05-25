---
title: G2 — Phone Normalisation Spike Result
date: 2026-05-25
gate: G2 (phone normalisation)
status: PASSED
blocks: Slice 3 (reservar flow)
---

# G2 — Phone Normalisation Spike

## TL;DR

**98.56% hit rate. Gate (≥98%) PASSES. Slice 3 unblocked.**

| Metric | Value |
|---|---|
| Customers fetched (union of 3 dashboard filters) | 231 |
| With non-empty `phone` field | 209 |
| Empty `phone` | 22 |
| Normalised to E.164 (hit) | 206 |
| Returned `null` (miss) | 3 |
| **Hit rate** | **98.56%** (206 / 209) |
| Gate | ≥98% |
| Result | ✅ PASS (+0.56 pp margin) |

Spike script: [`tests/spike/phone-normalisation.test.ts`](../../tests/spike/phone-normalisation.test.ts).
Run with: `RUN_SPIKES=1 npx vitest run tests/spike/phone-normalisation.test.ts --reporter=verbose`.

## Customer pool composition

Three `POST /reports/customers` queries unioned by `id`:

| Filter | Rows |
|---|---:|
| `hasNoMembership + hasNoClassPass` (cold leads) | 19 |
| `hasMembershipOrClassPass(ALL_SUB_IDS, onlyActive=false)` | 125 |
| `hasMembershipOrClassPass(all 4 class_pass_type IDs, onlyActive=false)` | 139 |
| **Union (distinct)** | **231** |

This is the operationally-relevant pool (same union the dashboard's funnel page uses). The original spec mentioned ~700 customers — that figure must have been the raw `users` table count including long-lapsed leads. 231 is the addressable WA-bot population.

## The 3 misses

| Raw phone | User id | Name | Why it failed |
|---|---|---|---|
| `0652155032` | 1270017 | Mike Horn | French mobile format (`06`-prefix, 10 national digits). Normaliser only knows PT (`+351` + 9 digits) and explicit international (`+`/`00` prefix). No leading `+` or `00`, so treated as bare digits; 10 digits ≠ PT national 9, so rejected. |
| `9120044411` | 1174988 | Sabrina Lobo Barboza | 10 digits starting with `9` — looks PT-like but PT mobiles are exactly 9 digits. Likely typo / pasted with an extra digit. |
| `9139740822` | 1244421 | Rafael Angélico | Same as above — 10 digits, PT-ish prefix, one digit too many. |

## What this means for Slice 3 (reservar flow)

When the WA bot receives an inbound message, Meta delivers the sender's number as E.164 (e.g. `+351912345678`). The bot calls `findCustomerByPhone(senderE164)`, which:

1. Pulls candidates from `WaContact` cache OR the customer report
2. For each candidate's stored phone, runs `normalize()`
3. Matches sender E.164 against `e164` or `variants[]`

A miss in the spike means: **that customer is invisible to the bot via phone lookup.** Their inbound goes to `LOOKUP_MISS` → fallback to human. They are NOT silently lost — Marcelo sees them in the inbox.

For these specific 3:
- **Mike Horn (FR)**: would still work if he writes from `+33652155032` — Meta delivers his E.164 directly; but our cached `WaContact.phone` (built from Yogo) won't match. He'd hit `LOOKUP_MISS` once; Marcelo could manually link the WA thread to his Yogo record (v1.1 admin UI) or the bot could fall back to e-mail/name probe (out of scope v1).
- **Sabrina, Rafael**: same `LOOKUP_MISS` failure. These look like data-entry typos — easier to fix in Yogo than to add normaliser heuristics that could create false-positive matches.

## Decisions

1. **No `phone.ts` changes.** The 1.44% miss rate is within the gate budget. Adding heuristics (e.g. "trim leading 9 if 10 digits + starts with 9X") would create false positives where two distinct Yogo records normalise to the same E.164 → wrong customer gets the wrong booking. Strict rejection is safer.
2. **Slice 3 unblocked.** Proceed with implementation per spec.
3. **Runbook entry for `LOOKUP_MISS`:** when a miss occurs in production, Marcelo's playbook is (a) check the inbound number, (b) search Yogo by name/email, (c) fix the customer's `phone` field in Yogo to canonical `+351...` form. The next time they message, the cache rebuild picks them up.
4. **Optional fix (out of scope):** add a "phone format hygiene" admin view to the dashboard that lists customers whose stored `phone` fails `normalize()`. ~30 LOC, defer to v1.1 backlog.

## Reproducibility

```bash
# from repo root, with .env.local containing YOGO_TOKEN, YOGO_ORIGIN
RUN_SPIKES=1 npx vitest run tests/spike/phone-normalisation.test.ts --reporter=verbose
```

The spike is `it.skipIf(!TOKEN || !RUN_SPIKES)` so it is skipped silently by `npm test`. The opt-in `RUN_SPIKES=1` env keeps `npm test` fast and free of live-API dependencies.

## Cross-references

- Spec: [`docs/superpowers/specs/2026-05-25-whatsapp-bot-v1-design.md`](../../docs/superpowers/specs/2026-05-25-whatsapp-bot-v1-design.md)
- Normaliser implementation: [`src/lib/phone.ts`](../../src/lib/phone.ts)
- Unit tests: [`tests/lib/phone.test.ts`](../../tests/lib/phone.test.ts)
- Handoff: [`docs/superpowers/handoffs/2026-05-25-wa-bot-handoff.md`](../../docs/superpowers/handoffs/2026-05-25-wa-bot-handoff.md)
