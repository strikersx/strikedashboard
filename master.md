---
title: StrikeHouse Dashboard
date: 2026-04-28
status: active
tags:
  - project
  - dashboard
  - main-hub
aliases:
  - Project Master
---

# Striker's House Dashboard

Dashboard de controlo operacional para a academia Striker's House em Carcavelos. Proxy para Yogo Booking API com KPIs, funil de conversão, gestão de leads e auditoria WhatsApp.

> [!info] Stack
> Next.js 15 (App Router) · SQLite/Prisma · Tailwind CSS · Vercel

## Specs & Design

- [[2026-04-28-dashboard-v2-design|Dashboard v2 — Design Spec]] — arquitectura, módulos, roadmap completo

## Arquitectura

```
Next.js 15 (App Router)
├── /api/auth         → login + sessão (cookie httpOnly)
├── /api/yogo/*       → proxy passthrough → api.yogo.dk
├── /dashboard/*      → pages React (overview, revenue, funnel, etc.)
└── prisma/           → SQLite (MVP vazio, cresce nos sprints)
```

## Módulos

### MVP — Migração do Dashboard Actual

| Módulo | Estado |
|--------|--------|
| Auth (admin/vendas) | pendente |
| Yogo proxy passthrough | pendente |
| Visão Geral | pendente |
| Faturação YTD | pendente |
| Funil de conversão | pendente |
| Subscritores | pendente |
| PTs do Marcelo | pendente |
| Leads frios | pendente |
| Trials sem conversão | pendente |
| Risco de Churn | pendente |
| Pagamentos falhados | pendente |
| Visitantes USC/CP | pendente |
| Painel Vendas | pendente |

### Sprints Futuros

| Sprint | Objectivo | Depende de |
|--------|-----------|------------|
| [[2026-04-28-dashboard-v2-design#Sprint 1 — Auditoria WhatsApp ↔ Yogo\|Sprint 1]] | Auditoria WhatsApp ↔ Yogo | MVP |
| [[2026-04-28-dashboard-v2-design#Sprint 2 — Funil de Leads Completo\|Sprint 2]] | Funil de Leads (Kanban + CRUD) | Sprint 1 |
| [[2026-04-28-dashboard-v2-design#Sprint 3 — Token Yogo Sempre Activo\|Sprint 3]] | Token auto-refresh + config externo | Sprint 1 |
| [[2026-04-28-dashboard-v2-design#Sprint 4 — WhatsApp Cloud API\|Sprint 4]] | WhatsApp Cloud API + automações | Sprints 1-3 |

## Ambiente

### Pré-requisitos

- Node.js 20+
- npm/pnpm
- SQLite3

### Setup

```bash
npm install
cp .env.example .env.local   # preencher secrets
npx prisma generate
npm run dev
```

### Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `ADMIN_PWD` | Senha admin (Ricardo + Marcelo) |
| `SALES_PWD` | Senha vendas |
| `YOGO_TOKEN` | JWT token Yogo (válido até Out/2026) |
| `YOGO_BASE` | `https://api.yogo.dk` |
| `YOGO_ORIGIN` | `https://strikershouse.yogobooking.pt` |

## Stakeholders

- **Ricardo** — desenvolvimento, admin
- **Marcelo** — operações, admin
- **Equipa vendas** — gestão de leads, conversão

## Quick Links

| Recurso | Link |
|---------|------|
| Design Spec | [[2026-04-28-dashboard-v2-design]] |
| Dashboard actual (Python) | `striker_dashboard.py` |
| Yogo Booking | [strikershouse.yogobooking.pt](https://strikershouse.yogobooking.pt) |

---

> [!tip] Navegação
> Use os wikilinks acima para navegar entre documentos. Os links para secções do design spec (`#Sprint 1`, etc.) levam directamente à secção relevante.
