---
title: Arquitectura
type: technical
---

# Arquitectura

## Stack

| Tecnologia | Uso |
|------------|-----|
| **Next.js 15** | App Router — monorepo com API routes + React UI |
| **React 19** | Client components para UI |
| **TypeScript** | Todo o projecto, strict mode |
| **Prisma** | ORM para SQLite |
| **SQLite** | DB embedded (`~/.strikers/striker.db`) |
| **Tailwind CSS v4** | Styling (dark theme) |
| **Vercel** | Deploy e hosting |

## Decisoes de Arquitectura

| Decisao | Escolha | Alternativas descartadas |
|---------|---------|--------------------------|
| Framework | Next.js 15 (App Router) | NestJS + React separados, Python |
| DB | SQLite via Prisma | LowDB, Better-SQLite3 |
| Deploy | Vercel | Self-hosted, Docker |
| Auth | Senhas fixas + cookie httpOnly | NextAuth.js |
| Yogo API | Proxy passthrough (tempo real) | Sync periodico, hibrido |
| Monorepo | Next.js unico (API routes + UI) | Monorepo com workspaces separados |
| UI | Custom Tailwind | Material UI, Chakra, shadcn |

## File Structure

```
strikehousedashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # root layout (dark theme)
│   │   ├── page.tsx                      # redirect -> login ou dashboard
│   │   ├── login/page.tsx                # pagina de login
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                # nav + header + auth guard
│   │   │   ├── page.tsx                  # Visao Geral (admin) / Sales Home
│   │   │   ├── revenue/page.tsx          # Faturacao YTD
│   │   │   ├── funnel/page.tsx           # Funil de conversao
│   │   │   ├── subscribers/page.tsx      # Subscritores por plano
│   │   │   ├── pts/page.tsx              # PTs do Marcelo
│   │   │   ├── leads/page.tsx            # Leads frios
│   │   │   ├── trials/page.tsx           # Aulas experimentais
│   │   │   ├── churn/page.tsx            # Risco de churn
│   │   │   ├── failed/page.tsx           # Pagamentos falhados
│   │   │   └── classes/page.tsx          # Visitantes USC/CP/Bruce
│   │   └── api/
│   │       ├── auth/route.ts             # POST login, GET session, DELETE logout
│   │       └── yogo/[...path]/route.ts   # proxy passthrough -> api.yogo.dk
│   ├── components/                       # StatCard, Pill, BarChart, DataTable, etc.
│   ├── hooks/                            # useAuth, useYogo
│   └── lib/
│       ├── auth.ts                       # cookie validation, roles
│       ├── yogo-proxy.ts                 # server-side proxy logic
│       ├── constants.ts                  # SUB_IDS, PLAN_ORDER, PLAN_VALUES
│       └── utils.ts                      # date, currency, plan helpers
├── prisma/
│   └── schema.prisma                     # MVP: vazio. Sprint 1+: cresce
├── .env.local                            # secrets (nunca commitar)
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## Key Patterns

- **Yogo proxy:** catch-all `/api/yogo/[...path]` forward para `api.yogo.dk` com token. Zero transformacao.
- **Pages:** cada tab do dashboard e uma page separada. Client components que fazem fetch a `/api/yogo/*`.
- **Componentes:** todos custom, sem libs externas. Tailwind directo.
- **Auth:** cookie httpOnly com role. Middleware bloqueia `/dashboard/*` sem sessao.
- **Dados:** Yogo e source of truth. SQLite so para dados que Yogo nao tem (sprint 1+).

## Environment Variables

```env
ADMIN_PWD=              # senha admin
SALES_PWD=              # senha vendas
YOGO_TOKEN=             # JWT token Yogo
YOGO_BASE=https://api.yogo.dk
YOGO_ORIGIN=https://strikershouse.yogobooking.pt
DATABASE_URL="file:./dev.db"
```

## Dev Commands

```bash
npm install
cp .env.example .env.local   # preencher secrets
npx prisma generate
npm run dev                   # localhost:3000
npm run build                 # production build
npx prisma studio             # DB browser
```

## Related

- [[Design-System]] — cores, tema, spacing
- [[Componentes]] — componentes partilhados
- [[Yogo-API]] — proxy e endpoints
- [[Auth-System]] — auth e middleware
