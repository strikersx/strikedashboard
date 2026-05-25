---
title: WhatsApp Bot v1 — Design Spec (canonical pointer)
type: design
date: 2026-05-25
status: ready-for-implementation
---

# WhatsApp Bot v1 — Spec Pointer

Spec canónico em `docs/superpowers/specs/2026-05-25-whatsapp-bot-v1-design.md`.

Resultado do workflow development-workflow (vault → karpathy → brainstorm → autoresearch:reason adversarial → acceptance criteria SMDV → search-before-create).

## Sumário

- **Goal:** 3 fluxos pull (reserva, cancelar, fallback) + cron diário trial follow-up
- **Done:** 10 reservas + 5 cancels com ≥5 alunos, 1 semana, <2% erro, ≥75% cron delivery
- **7 slices, ~1260 LOC**
- **3 pre-slice gates** G1 (System User token), G2 (phone spike), G3 (template Meta)

## Adversarial trace

`reason/260525-0025-wa-bot-v1-plan-review/` — overview, candidates A/B/AB, lineage, judge transcripts. AB venceu 3-0 unanimous round 1.

## Related

- [[WhatsApp-Bot-Design]] — design original (Sprint 4 completo) — superseded
- [[Roadmap]] — Sprint 4 substituído por este âmbito
- [[Gotchas]] — #1 token, #2 Vercel+SQLite, #3 USC filter
- [[Yogo-API]] — endpoints `/classes`, `/class-signups`, `/customers`
