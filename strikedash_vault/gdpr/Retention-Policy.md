---
title: Política de Retenção — StrikeLab
type: reference
status: draft
created: 2026-05-29
tags:
  - strikelab
  - gdpr
related:
  - "[[DPIA-StrikeLab]]"
  - "[[ROPA-Strikelab]]"
---

# Política de Retenção de Dados — StrikeLab

## Períodos de Retenção

| Dado | Retenção | Justificação | Eliminação |
|------|---------|-------------|-----------|
| Event log (presenças, eventos) | 24 meses | Histórico para dispute resolução | Auto-purge após 24 meses |
| State materializado (pontos/XP) | Mensal (reset) + XP vitalício | Operação do programa | Monthly reset + erasure |
| Monthly snapshots | 12 meses selados | Prize disputes | Auto-purge após 12 meses |
| Identity (phone/email/IG) | Até pedido de erasure | Operação contínua | Track A (pseudonimiza) / Track B (elimina) |
| Consentimento toggles | Até pedido de erasure | Obrigação legal (Art. 7) | Erasure request |
| DOB (birth year) | Até pedido de erasure | Protecção de menores | Erasure request |
| Erasure audit log | 24 meses | Compliance demonstration | Auto-purge |
| Reset audit log | 24 meses | Compliance demonstration | Auto-purge |
| Yogo membership snapshots | 90 dias | Detecção de renovação/dunning | Auto-purge |

## Processo de Erasure

### Track A — Pseudonimização (imediato)

1. Identity tombstoned (`erasedAt` timestamp)
2. Campos PII limpos (phone → `erased_{id}`, email → null, IG → null)
3. Event payloads anonimizados (`{anonymised: true}`)
4. State zeroado
5. `customer_id` retido para estatísticas agregadas

### Track B — Eliminação completa (≥12 meses após Track A)

1. Verificação de cooling period (12 meses)
2. `customer_id` hasheado em event log
3. Identity row eliminada
4. State e snapshots eliminados

## Auto-purge (automático)

Implementado via cron jobs:

- **Eventos > 24 meses:** `DELETE FROM gamification_event_log WHERE createdAt < now - 24months` (Phase 1)
- **Snapshots > 90 dias:** `DELETE FROM yogo_membership_snapshot WHERE capturedAt < now - 90dias` (Phase 1)
- **Snapshots mensais > 12 meses:** `DELETE FROM gamification_monthly_snapshot WHERE sealedAt < now - 12months` (Phase 1)

> **Nota:** Auto-purge será implementado em Phase 1. Phase 0 gere retenção manualmente.
