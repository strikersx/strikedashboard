---
title: DPIA — StrikeLab Gamification
type: reference
status: draft
created: 2026-05-29
tags:
  - strikelab
  - gdpr
  - dpia
related:
  - "[[StrikeLab-v3.2-final]]"
  - "[[StrikeLab-Phase-0-Decisions]]"
---

# Data Protection Impact Assessment — StrikeLab

## 1. Identificação do Tratamento

| Campo | Valor |
|-------|-------|
| **Responsável** | Striker's House Lda (Ricardo Correia) |
| **DPO** | A designar (DG-2) |
| **Data da avaliação** | 2026-05-29 |
| **Revisão** | Phase 0 launch |

## 2. Descrição do Tratamento

StrikeLab é um programa de gamificação interna que:
- Regista presenças em aulas via check-in Yogo
- Atribui pontos e XP por treino
- Mantém leaderboard mensal com prémios
- Liga identidade Yogo ↔ WhatsApp ↔ Instagram (opcional)

### Dados pessoais processados

| Dado | Fonte | Base legal | Retenção |
|------|-------|-----------|----------|
| Customer ID (Yogo) | Yogo API | Contrato | Durante subscrição + 12 meses |
| Telefone (E.164) | Yogo / WhatsApp | Consentimento | Até erasure request |
| Email | Yogo | Consentimento | Até erasure request |
| Instagram handle | Verificação IG | Consentimento explícito | Até erasure request |
| Presenças em aulas | Yogo check-in | Interesse legítimo | 24 meses |
| Pontuação / XP | Calculado | Consentimento | 12 meses (mensal) / Vitalício (XP) |
| Data de nascimento (ano) | Yogo DOB | Obrigação legal (menores) | Até erasure request |
| Consentimentos (4 toggles) | Bot WhatsApp | Consentimento | Até erasure request |

## 3. Necessidade e Proporcionalidade

- **Necessário para:** Motivar treino regular, reter alunos, criar comunidade
- **Proporcional:** Apenas dados estritamente necessários, sem profiling externo
- **Menos intrusivo?** Não — pontos por presença é o mínimo para gamificação

## 4. Riscos Identificados

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|--------------|---------|-----------|
| R1 | Acesso não autorizado a dados de menores | Baixa | Alto | Role-based admin (admin only), não expor nomes de menores |
| R2 | Vazamento de leaderboard com dados pessoais | Média | Médio | Leaderboard usa alias, nome real só com consent explicit |
| R3 | Retenção excessiva de dados | Baixa | Médio | Auto-reset mensal + Track A/B erasure |
| R4 | Instagram handle usado para stalking | Baixa | Alto | IG verificação via challenge code, handle não exposto publicamente |
| R5 | Discriminação por pontos baixos | Média | Baixo | Leaderboard mostra apenas top, não fondo |

## 5. Medidas de Segurança

- **Transporte:** HTTPS (Vercel TLS 1.3)
- **Storage:** Turso (encrypted at rest), SQLite local dev
- **Auth:** Cookie httpOnly, role-based (admin/sales)
- **Erasure:** Two-track (pseudonimização + eliminação)
- **Audit:** Event log imutável com idempotency keys
- **Access:** Apenas admin vê dados individuais. Sales não tem acesso StrikeLab.

## 6. Avaliação de Menores (Art. 8)

- **Idade mínima:** 13 anos
- **13-17:** Autorização parental obrigatória (ref registada)
- **DOB enforcement:** Script auditor (Task 16) antes do launch
- **Bot:** Recusa onboarding se DOB nulo no Yogo

## 7. Assinatura

| Papel | Nome | Data | Assinatura |
|-------|------|------|------------|
| Responsável | Ricardo Correia | ___/___/______ | __________ |
| DPO / Advogado | ___ | ___/___/______ | __________ |

> **DG-2 GATE:** Este documento requer revisão por advogado (~€300) antes do go-live.
