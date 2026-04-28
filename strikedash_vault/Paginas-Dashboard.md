---
title: Paginas do Dashboard
type: technical
---

# Paginas do Dashboard

Cada tab do dashboard e uma page separada no App Router. Todas sao client components que fazem fetch a `/api/yogo/*`.

## Overview (`/dashboard`)

### Admin view
- **Row 1 KPIs:** Faturacao YTD, Subscritores Activos, Risco Churn, Pagamentos Falhados
- **Row 2 KPIs:** Aulas Experimentais, Leads Frios, PTs do Marcelo, USC/CP/Bruce
- **Seccao:** Funnel de conversao (3-stage progress + action cards)
- **Seccao:** Subscritores (contagem por plano)
- **Seccao:** PT payments (tabela de proximos pagamentos)

### Sales view
- **KPIs:** Leads frios, Trials, Classes (mini stat cards)
- **Seccao:** Funil (3-stage + action cards)
- **Seccao:** Leads table
- **Seccao:** Trials
- **Seccao:** Classes (visitantes)

### Data fetches
- `fetchActiveSubs` — POST `/reports/customers` com `hasMembershipOrClassPass`
- `fetchActiveMemberships` — POST `/reports/memberships-list` com `status: ['active']`
- `fetchChurn` — POST `/reports/customers` com zero signups + active membership
- `fetchFailed` — POST `/reports/memberships-list` com `payment_failed`
- `fetchLeads` — POST `/reports/customers` sem membership/class pass
- `fetchTrialNoConv` — POST `/reports/customers` sem membership + trial class pass
- `fetchClasses` — GET `/classes` com date range + populate
- `fetchRevenue` — POST `/graphql` com `revenueReport`

## Revenue (`/dashboard/revenue`) — Admin only

- **4 MiniStats:** Total c/ IVA, s/ IVA, IVA, Media mensal
- **BarChart:** Faturacao mensal (Jan-Dez, mes actual highlighted)
- **Top items:** Progress bars com percentagem
- **Revenue by type:** Progress bars por categoria
- **Data:** GraphQL `revenueReport` query para ano corrente

## Funnel (`/dashboard/funnel`)

3-stage conversion funnel:
1. **Leads frios** — count + % (leads / total)
2. **Aulas experimentais** — count + % (trials / total)
3. **Subscritores** — count + % (subs / total)

3 action cards below:
- "Foram a aula" — hot leads para fechar
- "Faltaram/agendado" — warm leads para reagendar
- "Leads sem aula" — cold leads para contactar

## Subscribers (`/dashboard/subscribers`) — Admin only

- Filtro/search por nome de plano
- Agrupado por plano (PLAN_ORDER)
- Por subscritor: nome, email, plano, PaymentBadge, data renovacao
- Badge colors: red <7d, amber 7-14d, green >14d
- Total activos no topo

## PTs (`/dashboard/pts`) — Admin only

- Subscritores PT filtrados por `isPTPlan()`
- Mesmo layout que Subscribers
- Seccao extra: "Proximos pagamentos" (top 10)
- Highlights planos recorrentes do Marcelo

## Leads (`/dashboard/leads`)

- Clientes sem membership E sem class pass
- Filtrado: exclui USC/internos via `isNonActionableLead()`
- DataTable com colunas auto-detectadas, max 8 cols
- Search/filter por nome, email
- Badge count: "Leads frios (N)"

## Trials (`/dashboard/trials`)

- Classes com `class_type_id = TRIAL_CLASS_TYPE_ID`
- ClassList agrupada por data
- Por aula: nome, horario, professor, sala, signup count, check-in count
- Aggregator pills: USC, ClassPass, Bruce, waiting list
- 3 seccoes: Today, This week, This month

## Trials Without Conversion (`/dashboard/trials-no-conv`)

- Clientes com trial class pass mas sem membership
- 2 seccoes:
  - "Foram a aula" (pink/emerald border) — hot leads para follow-up
  - "Faltaram/agendado" (amber border) — reagendar
- Por pessoa: nome, email, data trial, notas

## Churn (`/dashboard/churn`) — Admin only

- Subscritores activos com zero signups nos ultimos 30 dias
- Red theme
- DataTable: nome, email, plano, ultima inscricao, payment status, dias inactivo
- Filtrado a RECURRING_SUB_IDS apenas

## Failed Payments (`/dashboard/failed`) — Admin only

- Memberships com `payment_failed`
- Red theme
- Por entrada: nome, email, plano, data fim membership, razao de falha
- Accao: follow-up manual necessario

## Classes/Visitantes (`/dashboard/classes`)

- Todas as aulas com signups de USC, ClassPass, ou Bruce
- ClassList agrupada por data
- Por aula: contagem USC + CP + Bruce
- Pills individuais por agregador

## Navigation Map

| Page | Route | Admin | Sales |
|------|-------|-------|-------|
| Visao Geral | `/dashboard` | sim | sim |
| Faturacao | `/dashboard/revenue` | sim | nao |
| Funil | `/dashboard/funnel` | sim | sim |
| Subscritores | `/dashboard/subscribers` | sim | nao |
| PTs | `/dashboard/pts` | sim | nao |
| Leads | `/dashboard/leads` | sim | sim |
| Experimentais | `/dashboard/trials` | sim | sim |
| Churn | `/dashboard/churn` | sim | nao |
| Falhas | `/dashboard/failed` | sim | nao |
| Visitantes | `/dashboard/classes` | sim | sim |

## Related

- [[Componentes]] — componentes usados nas paginas
- [[Yogo-API]] — endpoints e data fetching
- [[Auth-System]] — role-based visibility
- [[Business-Constants]] — IDs e plan values
