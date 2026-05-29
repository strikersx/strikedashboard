---
title: ROPA — StrikeLab Gamificação
type: reference
status: draft
created: 2026-05-29
tags:
  - strikelab
  - gdpr
  - ropa
related:
  - "[[DPIA-StrikeLab]]"
---

# Registo de Actividades de Tratamento (Art. 30 RGPD) — StrikeLab

## Actividade 1: Presença em Aulas

| Campo | Valor |
|-------|-------|
| **Finalidade** | Contabilizar presenças para pontuação gamificada |
| **Categorias de titulares** | Subscritores activos Striker's House |
| **Categorias de dados** | Customer ID, data/hora check-in, tipo de aula |
| **Destinatários** | Dashboard admin (Ricardo, Marcelo) |
| **Transferências internacionais** | Vercel (EUA — SCCs), Turso (UE) |
| **Retenção** | Event log: 24 meses. State materializado: 12 meses (reset) |
| **Base legal** | Consentimento (Art. 6(1)(a)) + Interesse legítimo (Art. 6(1)(f)) |
| **Medidas técnicas** | HTTPS, encryption at rest, role-based access |

## Actividade 2: Identidade Multi-Canal

| Campo | Valor |
|-------|-------|
| **Finalidade** | Ligar perfil Yogo ↔ WhatsApp ↔ Instagram |
| **Categorias de titulares** | Subscritores que opt-in ao StrikeLab |
| **Categorias de dados** | Phone E.164, email, Instagram handle, WhatsApp WA ID |
| **Destinatários** | Dashboard admin apenas |
| **Transferências internacionais** | Vercel (EUA — SCCs) |
| **Retenção** | Até pedido de erasure |
| **Base legal** | Consentimento explícito (Art. 6(1)(a)) |
| **Medidas técnicas** | Pseudonimização em Track A, hashing em Track B |

## Actividade 3: Consentimentos

| Campo | Valor |
|-------|-------|
| **Finalidade** | Registar 4 toggles de consentimento do utilizador |
| **Categorias de titulares** | Subscritores StrikeLab |
| **Categorias de dados** | Flags consentTraining, consentUgc, consentRealName, consentBroadcasts + timestamps |
| **Destinatários** | Dashboard admin |
| **Retenção** | Até pedido de erasure |
| **Base legal** | Cumprimento obrigação legal (Art. 6(1)(c)) — registo de consentimentos |
| **Medidas técnicas** | Audit event log com timestamp |

## Actividade 4: Erasure (Art. 17)

| Campo | Valor |
|-------|-------|
| **Finalidade** | Cumprir direito ao apagamento |
| **Categorias de titulares** | Qualquer subscritor que solicite |
| **Categorias de dados** | Todos os dados pessoais do titular |
| **Destinatários** | N/A (operação interna) |
| **Retenção** | Track A: pseudonimizado mantém customer_id. Track B: eliminação total após 12 meses |
| **Base legal** | Obrigação legal (Art. 17 RGPD) |
| **Medidas técnicas** | Two-track, audit log, operator ID registado |
