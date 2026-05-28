---
date: 2026-05-27
status: blocked-sandbox-limit
title: WhatsApp Group Invite — Rollout 2026-05-27
type: reference
---

# WhatsApp Group Invite — Rollout Log

Documenta o setup da feature [[WhatsApp-Bot-v1-Spec|bulk group invite]] e o estado da submissão do template Meta.

## PR

[#18 — feat(wa-invite): bulk WhatsApp group invite from coverage page](https://github.com/strikersx/strikedashboard/pull/18)

Branch: `feat/wa-group-invite`. Spec: `docs/superpowers/specs/2026-05-27-wa-group-invite-design.md`. Plano: `docs/superpowers/plans/2026-05-27-wa-group-invite.md`.

## Env vars Vercel

`WA_GROUP_INVITE_URL` definido em Development + Preview + Production (Vercel CLI 50.1.6) a 2026-05-27 12:25. Valor:

```
https://chat.whatsapp.com/DGCaCWN19eM3kEXlWXipoE?s

---

## 2026-05-28 update — bloqueado por sandbox cap

Status passou de `pending-meta-approval` para `blocked-sandbox-limit`.

Template `convite_grupo_whatsapp` foi APROVADO pela Meta em 2026-05-28 (~04h após submissão).

Test send para Ricardo (`+351912873698`) funcionou.

Bulk send para 32 destinatários: 32× falhou com 131030 ("Recipient phone number not in allowed list"). Causa identificada: o `WA_PHONE_NUMBER_ID` aponta para o número sandbox grátis da Meta (`+1 555-647-8265`, verified_name