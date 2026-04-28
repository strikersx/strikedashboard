# CLAUDE.md

## Why This Exists

A Striker's House é uma academia de artes marciais em Carcavelos, Portugal. O Ricardo (fundador/dev) e o Marcelo (operações) gerem tudo — aulas, alunos, pagamentos, leads, WhatsApp — usando o Yogo Booking como sistema de gestão. O Yogo é bom para booking mas fraco em visibilidade operacional: não mostra churn, não cruza WhatsApp com pagamentos, não tem funil de vendas.

Este dashboard nasceu para resolver isso: dar ao Ricardo e Marcelo uma visão clara e accionável do negócio, e dar à equipa de vendas ferramentas para converter leads sem depender do Ricardo.

## RULE NOT SKIP
Always write all relevant memory and docs using 
"/obsidian-cli" Skills


## Documentation Practice

**ALWAYS save project documentation to the Obsidian vault, not memory.**

- Vault location: `./strikedash_vault/`
- Add wikilinks to [[The Vault.md]] (main index)
- Use markdown with frontmatter: `---` title, type (technical/design/reference) `---`
- Cross-reference related notes with `[[Note-Name|link text]]`
- Memory system (`~/.claude/projects/.../memory/`) is for session context only, not canonical docs

**When to document:**
- After bug fixes (create `Bug-Fixes-<Date>.md`, add to vault index)
- After architectural decisions (update relevant design docs)
- After discovering gotchas or patterns (create reference docs)
- After significant features (add to feature documentation)

**Why:** Obsidian is Ricardo's active knowledge system. Vault docs are discoverable, wikilinked, and persist independently of Claude sessions. Memory system is ephemeral and not guaranteed across sessions.


## What It Does

Dashboard operacional que puxa dados em tempo real do Yogo Booking API e apresenta:

- **Saúde do negócio:** faturação YTD, subscritores activos, PTs do Marcelo, risco de churn, pagamentos falhados
- **Funil de conversão:** leads frios → aula experimental → subscritor. Priorizado por acção (quem foi à aula = fechar agora, quem faltou = reagendar)
- **Visitantes externos:** USC, ClassPass, Bruce App — rastrear quem vem por agregadores
- **Painel de vendas:** vista focada para a equipa comercial, sem distrações admin

Evolui para: auditoria WhatsApp ↔ Yogo, funil de leads com Kanban, auto-refresh de token, e integração WhatsApp Cloud API.

## Who Uses It

| Pessoa | Role | Usa para |
|--------|------|----------|
| Ricardo | `admin` | Visão completa, decisões estratégicas, desenvolvimento |
| Marcelo | `admin` | Operações diárias, PTs, churn, pagamentos, auditoria WA |
| Equipa vendas | `sales` | Trabalhar leads, fechar trials, funil de conversão |

## Rules

### Linguagem
- UI e textos do dashboard em **português de Portugal** (não brasileiro). Usar "subscritor" não "assinante", "telemóvel" não "celular", "faturação" não "faturamento".
- Código, commits, e documentação técnica em **inglês**.
- CLAUDE.md e specs podem misturar pt/en conforme fizer sentido.

### Design
- **Dark theme obrigatório.** Fundo preto (`bg-black`), cards `bg-zinc-900`, borders `border-zinc-800`.
- **Cores têm significado fixo:** emerald=receita/sucesso, blue=subscritores, amber=churn/aviso, red=falha/urgente, purple=leads, pink=trials, cyan=PTs.
- **Mobile-first.** O Marcelo usa no telemóvel na recepção da academia. Tudo tem de funcionar bem em ecrãs pequenos.
- **Zero dependências de UI library.** Sem Material UI, Chakra, shadcn. Tailwind CSS directo. Componentes custom simples.

### Código
- **TypeScript strict.** Sem `any`, sem `@ts-ignore`.
- **Ficheiros pequenos e focados.** Uma page por ficheiro, um componente por ficheiro. Se um ficheiro passa de ~200 linhas, provavelmente deve ser partido.
- **Sem over-engineering.** Este é um dashboard interno para 3 pessoas. Não precisa de i18n, accessibility perfeita, ou testes E2E. Precisa de funcionar e ser fácil de alterar.
- **Secrets nunca no código.** Tudo via `.env.local`. O `.env.example` tem as keys sem valores.

### Dados
- **Yogo é source of truth.** Não duplicar dados do Yogo no SQLite. O proxy passthrough mantém tudo em tempo real.
- **SQLite é para dados que o Yogo não tem:** contactos WhatsApp, estado de auditoria, leads internos, histórico de acções, mensagens WA.
- **Filtrar lixo:** emails `usc-*@urbansportsclub.com` e `@strikershouse.*` não são leads reais. Filtrar sempre.

### Auth
- Senhas fixas no `.env.local`. Sem signup, sem recovery, sem OAuth. Simples.
- Cookie `httpOnly` com role. Middleware bloqueia `/dashboard/*` sem sessão válida.
- `admin` vê tudo. `sales` vê apenas: Funil, Leads, Trials, Classes, Painel Vendas.

## Stack

- **Next.js 15** (App Router) — monorepo, API routes + React UI
- **React 19** — client components
- **TypeScript** — todo o projecto
- **Prisma** — ORM para SQLite (migra para Turso em prod)
- **SQLite** — banco embedded (`~/.strikers/striker.db`)
- **Tailwind CSS v4** — styling
- **Vercel** — deploy

## Getting Started

```bash
npm install
cp .env.example .env.local   # preencher secrets
npx prisma generate
npm run dev
```

### Environment Variables (.env.local)

```
ADMIN_PWD=         # senha admin
SALES_PWD=         # senha vendas
YOGO_TOKEN=        # JWT token Yogo
YOGO_BASE=https://api.yogo.dk
YOGO_ORIGIN=https://strikershouse.yogobooking.pt
```

## Architecture

```
src/
├── app/
│   ├── layout.tsx                    # root layout (dark theme)
│   ├── page.tsx                      # redirect → login ou dashboard
│   ├── middleware.ts                  # auth guard para /dashboard/*
│   ├── login/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx                # nav + header
│   │   ├── page.tsx                  # Visão Geral
│   │   ├── revenue/page.tsx
│   │   ├── funnel/page.tsx
│   │   ├── subscribers/page.tsx
│   │   ├── pts/page.tsx
│   │   ├── leads/page.tsx
│   │   ├── trials/page.tsx
│   │   ├── churn/page.tsx
│   │   ├── failed/page.tsx
│   │   └── classes/page.tsx
│   └── api/
│       ├── auth/route.ts             # POST login, GET session
│       └── yogo/[...path]/route.ts   # proxy passthrough → api.yogo.dk
├── components/                       # StatCard, Pill, DataTable, BarChart, Nav, Icons
├── hooks/                            # useAuth, useYogo
└── lib/
    ├── yogo-proxy.ts                 # server-side proxy logic
    ├── auth.ts                       # cookie validation, roles
    └── constants.ts                  # SUB_IDS, PLAN_ORDER, PLAN_VALUES
```

## Key Patterns

- **Yogo proxy:** catch-all `/api/yogo/[...path]` forward para `api.yogo.dk` com token. Zero transformação.
- **Pages:** cada tab do dashboard é uma page separada. Client components que fazem fetch a `/api/yogo/*`.
- **Componentes:** `StatCard`, `Pill`, `DataTable`, `BarChart`, `PaymentBadge`, `ClassList` — todos custom, sem libs externas.

## Business Constants

```typescript
ALL_SUB_IDS = [6021, 6107, 6020, 6178, 6361, 6293, 6294, 6153]
RECURRING_SUB_IDS = [6021, 6107, 6020, 6153]
TRIAL_CLASS_TYPE_ID = 21792
TRIAL_CLASS_PASS_ID = 14172
```

## Yogo API

- Base: `https://api.yogo.dk`
- Auth: `Bearer {YOGO_TOKEN}` + `x-yogo-request-context: admin`
- Reports: POST com filtros JSON (`/reports/customers`, `/reports/memberships-list`)
- Classes: GET com query params (`/classes?startDate=...&populate[]=...`)
- Revenue: GraphQL (`/graphql` com query `revenueReport`)

## Commands

```bash
npm run dev             # dev server (localhost:3000)
npm run build           # production build
npm run lint            # ESLint
npx prisma studio       # DB browser
npx prisma migrate dev  # run migrations
```

## Roadmap

1. **MVP** — migrar dashboard actual (proxy Yogo, KPIs, auth, todas as tabs)
2. **Sprint 1** — Auditoria WhatsApp ↔ Yogo
3. **Sprint 2** — Funil de Leads completo (Kanban + CRUD)
4. **Sprint 3** — Token Yogo auto-refresh
5. **Sprint 4** — WhatsApp Cloud API

## Design Spec

`docs/superpowers/specs/2026-04-28-dashboard-v2-design.md`

## Important Gotchas

- **Vercel + SQLite:** filesystem read-only em serverless. MVP não precisa de escrita. Sprint 1+ migra para Turso.
- **Yogo token:** JWT expira ~6 meses. Actual expira Out/2026. Sprint 3 resolve.
- **USC leads:** `usc-*@urbansportsclub.com` e `@strikershouse.*` não são leads reais — filtrar sempre.
- **Planos PT:** regex match no `membership_description` — nomes vêm do Yogo e podem mudar.
