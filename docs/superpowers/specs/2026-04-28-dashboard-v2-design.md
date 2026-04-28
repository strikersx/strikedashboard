---
title: "Striker's House Dashboard v2 — Design Spec"
date: 2026-04-28
status: approved
tags:
  - spec
  - architecture
  - nextjs
  - dashboard
aliases:
  - Dashboard v2 Spec
  - Arquitectura v2
---

# Striker's House Dashboard v2 — Design Spec

> [!abstract] Resumo
> Migração do dashboard single-file Python para **Next.js 15** (App Router) com **SQLite/Prisma**, deploy na **Vercel**. MVP replica funcionalidade actual; sprints seguintes adicionam auditoria WA, funil de leads, token refresh e WhatsApp Cloud API.

## Decisões de Arquitectura

| Decisão | Escolha | Alternativas descartadas |
|---------|---------|--------------------------|
| Framework | Next.js 15 (App Router) | NestJS + React separados, Python |
| DB | SQLite via Prisma | LowDB, Better-SQLite3 |
| Deploy | Vercel | Self-hosted, Docker |
| Auth | Senhas fixas + cookie httpOnly | NextAuth.js |
| Yogo API | Proxy passthrough (tempo real) | Sync periódico, híbrido |
| Monorepo | Next.js único (API routes + UI) | Monorepo com workspaces separados |

## Stack

- **Next.js 15** — App Router, server components + client components
- **React 19** — UI
- **Prisma** — ORM para SQLite
- **SQLite** — banco de dados embedded (`~/.strikers/striker.db`)
- **Tailwind CSS v4** — styling (manter visual dark actual)
- **TypeScript** — todo o projecto
- **Vercel** — deploy e hosting

## Arquitectura de Ficheiros

```
strikehousedashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # root layout (dark theme, fonts)
│   │   ├── page.tsx                        # redirect → /login ou /dashboard
│   │   ├── middleware.ts                   # protege /dashboard/*
│   │   ├── login/
│   │   │   └── page.tsx                    # página de login
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                  # header + nav + auth guard
│   │   │   ├── page.tsx                    # Visão Geral (overview)
│   │   │   ├── revenue/page.tsx            # Faturação YTD
│   │   │   ├── funnel/page.tsx             # Funil de conversão
│   │   │   ├── subscribers/page.tsx        # Subscritores por plano
│   │   │   ├── pts/page.tsx                # PTs do Marcelo
│   │   │   ├── leads/page.tsx              # Leads frios
│   │   │   ├── trials/page.tsx             # Aulas experimentais
│   │   │   ├── churn/page.tsx              # Risco de churn
│   │   │   ├── failed/page.tsx             # Pagamentos falhados
│   │   │   └── classes/page.tsx            # Visitantes USC/CP
│   │   └── api/
│   │       ├── auth/route.ts               # POST login, GET session
│   │       └── yogo/[...path]/route.ts     # proxy passthrough → api.yogo.dk
│   ├── components/
│   │   ├── stat-card.tsx
│   │   ├── pill.tsx
│   │   ├── data-table.tsx
│   │   ├── bar-chart.tsx
│   │   ├── nav.tsx
│   │   └── icons.tsx
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   └── use-yogo.ts                    # fetch wrapper para API routes
│   └── lib/
│       ├── yogo-proxy.ts                  # server-side: forward to api.yogo.dk
│       ├── auth.ts                        # cookie validation, roles
│       └── constants.ts                   # SUB_IDS, PLAN_ORDER, PLAN_VALUES
├── prisma/
│   └── schema.prisma                      # MVP: vazio. Sprint 1+: cresce
├── .env.local                             # secrets (nunca commitar)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Módulos do MVP

### 1. Auth

> [!info] Endpoint
> `POST /api/auth` — login
> `GET /api/auth` — verificar sessão

**Fluxo:**
1. Frontend envia `{ password }` via POST
2. Backend compara com `ADMIN_PWD` e `SALES_PWD` do `.env.local`
3. Se válido, cria cookie `httpOnly` com role (`admin` | `sales`)
4. Middleware em `src/middleware.ts` intercepta `/dashboard/*` e valida cookie
5. Se inválido, redirect para `/login`

**Roles e permissões:**

| Role | Vê | Não vê |
|------|-----|--------|
| `admin` | Tudo | — |
| `sales` | Funil, Leads, Trials, Classes, Painel Vendas | Revenue, Churn, Failed, Subscribers, PTs |

**Variáveis de ambiente:**

```env
ADMIN_PWD=carcavelos2026
SALES_PWD=leads2026
YOGO_TOKEN=eyJhbGci...
YOGO_BASE=https://api.yogo.dk
YOGO_ORIGIN=https://strikershouse.yogobooking.pt
```

### 2. Yogo Proxy

> [!info] Endpoint
> `GET/POST /api/yogo/*` — catch-all proxy

**Lógica:**
- Recebe qualquer request em `/api/yogo/reports/customers` → forward para `https://api.yogo.dk/reports/customers`
- Injeta headers: `Authorization: Bearer`, `x-yogo-request-context: admin`, `Origin`
- Devolve response do Yogo tal como está
- Suporta GET e POST (reports usam POST com body JSON)

```typescript
// src/app/api/yogo/[...path]/route.ts
export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  return proxyToYogo(req, params.path.join('/'));
}

export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  return proxyToYogo(req, params.path.join('/'), await req.text());
}
```

### 3. Dashboard Pages

Cada tab do dashboard actual vira uma page separada no App Router. Todas são **client components** que fazem fetch a `/api/yogo/*`.

| Page | Rota | Corresponde a |
|------|------|---------------|
| Visão Geral | `/dashboard` | tab `overview` |
| Painel Vendas | `/dashboard` (role sales) | tab `salesHome` |
| Faturação | `/dashboard/revenue` | tab `revenue` |
| Funil | `/dashboard/funnel` | tab `funnel` |
| Subscritores | `/dashboard/subscribers` | tab `subs` |
| PTs | `/dashboard/pts` | tab `pts` |
| Leads frios | `/dashboard/leads` | tab `leads` |
| Trials | `/dashboard/trials` | tab `trials` |
| Churn | `/dashboard/churn` | tab `churn` |
| Falhas | `/dashboard/failed` | tab `failed` |
| Visitantes | `/dashboard/classes` | tab `classes` |

### 4. Componentes Partilhados

Extraídos do HTML inline actual:

| Componente | Responsabilidade |
|------------|------------------|
| `<StatCard>` | KPI card com ícone, valor, sublabel, cor |
| `<Pill>` | Badge colorido (plano, estado, etc.) |
| `<DataTable>` | Tabela genérica com sort + paginação |
| `<BarChart>` | Gráfico de barras SVG (faturação mensal) |
| `<Nav>` | Sidebar/header com links por role |
| `<PaymentBadge>` | Badge de estado de pagamento |
| `<ClassList>` | Lista de aulas agrupada por data |

### 5. Prisma / SQLite

> [!note] MVP
> No MVP o schema Prisma é minimal — apenas a configuração base. O SQLite é criado mas não tem tabelas de negócio. Toda a data vem do Yogo em tempo real.

```prisma
// prisma/schema.prisma
datasource db {
  provider = "sqlite"
  url      = "file:~/.strikers/striker.db"
}

generator client {
  provider = "prisma-client-js"
}

// Tabelas adicionadas nos sprints seguintes
```

## Vercel + SQLite

> [!warning] Limitação
> Na Vercel (serverless), o filesystem é **read-only**. SQLite funciona em dev e para leitura, mas escrita requer solução alternativa.

**Estratégia por fase:**

| Fase | Necessidade de escrita | Solução |
|------|------------------------|---------|
| MVP | Nenhuma (proxy only) | SQLite local em dev, irrelevante em prod |
| Sprint 1+ | wa_contacts, leads, etc. | Migrar para **Turso** (SQLite remoto, compatível Prisma) |

Turso é um drop-in replacement: muda apenas a connection string no Prisma, zero mudanças no código.

## Constantes Migradas do Dashboard Actual

```typescript
// src/lib/constants.ts

export const ALL_SUB_IDS = [6021, 6107, 6020, 6178, 6361, 6293, 6294, 6153];
export const RECURRING_SUB_IDS = [6021, 6107, 6020, 6153];
export const TRIAL_CLASS_TYPE_ID = 21792;
export const TRIAL_CLASS_PASS_ID = 14172;

export const PLAN_ORDER = [
  '24 sessões/mês', '12 sessões/mês', '8 sessões/mês', 'Striking Trimestral',
  'PT (Marcelo) | 3x/sem', 'PT 4 Passes', 'PT 8 Passes', 'PT 12 Passes', 'Outros',
];

export const PLAN_VALUES: Record<string, number> = {
  '24 sessões/mês': 60,
  '12 sessões/mês': 50,
  '8 sessões/mês': 40,
  'Striking Trimestral': 50,
  'PT (Marcelo) | 3x/sem': 60,
  'PT 4 Passes': 200,
  'PT 8 Passes': 400,
  'PT 12 Passes': 600,
  'Outros': 0,
};
```

## Roadmap Pós-MVP

> [!tip] Cada sprint adiciona módulos ao projecto sem alterar o MVP

### Sprint 1 — Auditoria WhatsApp ↔ Yogo

**Schema Prisma adicional:**
- `WaContact` — contactos consolidados WhatsApp
- `WaImport` — histórico de imports
- `YogoSyncRun` — runs de sincronização

**Novas pages:**
- `/dashboard/audit` — página de auditoria com 5 buckets

**Novas API routes:**
- `GET /api/audit/buckets`
- `GET /api/audit/contacts`
- `POST /api/audit/contacts/[phone]/resolve`
- `POST /api/audit/sync-yogo`

**Funcionalidades:**
- Import de Excel/CSV para DB
- Classificação automática em 5 buckets (to_add, to_remove, lead_candidate, confirmed, noise)
- Cruzamento com Yogo por telefone normalizado
- UI com tabs, selecção múltipla, export CSV, copiar telefones

### Sprint 2 — Funil de Leads Completo

**Schema Prisma adicional:**
- `Lead` — leads com estados (new → contacted → trial_scheduled → trial_done → negotiating → converted → lost)
- `LeadHistory` — auditoria de mudanças

**Novas pages:**
- `/dashboard/leads/kanban` — vista Kanban com drag-drop
- `/dashboard/leads/table` — vista tabela com filtros

**Funcionalidades:**
- CRUD de leads com validação de duplicados
- Kanban com drag-drop nativo (HTML5)
- Migration automática de wa_contacts → leads
- Auto-sync com Yogo (lead que paga → auto-converted)
- Painel detalhe slide-in com histórico

### Sprint 3 — Token Yogo Sempre Activo

**Schema Prisma adicional:**
- `TokenEvent` — log de refreshes

**Config externo:** `~/.strikers/config.json` (secrets fora do código)

**Funcionalidades:**
- Refresh automático do token Yogo (API ou Playwright fallback)
- Banner global no header (verde/amarelo/vermelho)
- Página `/dashboard/admin/token` com logs e acções manuais
- Scheduler com retry e backoff

### Sprint 4 — WhatsApp Cloud API

**Schema Prisma adicional:**
- `WaMessage` — mensagens in/out
- `WaTemplate` — templates aprovados
- `Broadcast` — campanhas de mensagens
- `GroupInvitation` — convites ao grupo

**Novas pages:**
- `/dashboard/chat` — caixa de entrada estilo WhatsApp Web
- `/dashboard/broadcasts` — campanhas manuais

**Funcionalidades:**
- Webhook receiver para Meta WhatsApp
- Envio de templates aprovados
- Auto-convite ao grupo para novos clientes Yogo
- Auto-transitions de leads baseadas em mensagens
- Cloudflare Tunnel para webhook público

## Referências

- [[master|Hub do Projecto]]
- [[Runbook Cowork]] — plano original de 4 sprints
- [Yogo API](https://api.yogo.dk) — API do sistema de booking
- [Next.js App Router](https://nextjs.org/docs/app) — documentação oficial
- [Prisma + SQLite](https://www.prisma.io/docs/concepts/database-connectors/sqlite) — setup
- [Turso](https://turso.tech) — SQLite remoto para Vercel
