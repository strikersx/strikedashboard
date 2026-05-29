---
title: Acordos de Processador — StrikeLab
type: reference
status: draft
created: 2026-05-29
tags:
  - strikelab
  - gdpr
  - dpa
related:
  - "[[DPIA-StrikeLab]]"
---

# Acordos de Processador (Art. 28 RGPD) — StrikeLab

## Processadores Identificados

| # | Processador | Finalidade | Localização | DPA status |
|---|------------|-----------|-------------|-----------|
| P1 | **Vercel Inc.** | Hosting (dashboard + API + cron jobs) | EUA | ☐ DPA assinado |
| P2 | **Turso (ChiselStrike)** | Base de dados (SQLite managed) | UE (Frankfurt) | ☐ DPA assinado |
| P3 | **Yogo Booking** | Fonte de dados (customer, check-ins) | Dinamarca (UE) | ☐ Verificar termos existentes |
| P4 | **Meta / WhatsApp** | Canal de bot (onboarding, consentimentos) | EUA | ☐ Verificar Business API terms |

## Checklist por Processador

### Vercel (P1)

- [ ] Confirmar DPA disponível em Vercel dashboard (Settings → Legal)
- [ ] Confirmar SCCs (Standard Contractual Clauses) para transferência EUA
- [ ] Confirmar sub-processadores listados
- [ ] Data Processing Agreement: `https://vercel.com/legal/dpa`

### Turso (P2)

- [ ] Confirmar Turso processa dados apenas em UE
- [ ] Verificar termos de serviço para DPA
- [ ] Confirmar encryption at rest

### Yogo Booking (P3)

- [ ] Verificar termos de uso da API incluem DPA
- [ ] Confirmar que Yogo é controller (não processor) dos dados de cliente
- [ ] StrikeLab é controller independente dos dados gamificados

### Meta / WhatsApp (P4)

- [ ] WhatsApp Business API terms incluem DPA
- [ ] Confirmar SCCs para transferência EUA
- [ ] Registar WhatsApp como sub-processador se aplicável

## Notas

- **Yogo é controller**, não processor — os dados de cliente pertencem ao Yogo. O StrikeLab processa dados derivados (check-ins, pontos) como controller independente.
- **WhatsApp** é processador apenas para mensagens de onboarding/consentimento. Não partilhamos dados gamificados via WhatsApp.
- **Vercel** processa todos os dados em trânsito. SCCs necessários para conformidade RGPD.
