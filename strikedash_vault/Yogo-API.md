---
title: Yogo API Reference
type: technical
---

# Yogo API

## Overview

O dashboard usa o Yogo Booking como source of truth. Todos os dados vem em tempo real via proxy passthrough — zero transformacao, zero cache.

## Connection

| Propriedade | Valor |
|-------------|-------|
| Base URL | `https://api.yogo.dk` |
| Origin | `https://strikershouse.yogobooking.pt` |
| Auth | `Bearer {YOGO_TOKEN}` |
| Context header | `x-yogo-request-context: admin` |
| Token expiry | Outubro 2026 (Sprint 3 resolve auto-refresh) |

## Proxy Architecture

```
Browser -> /api/yogo/reports/customers -> proxyToYogo() -> api.yogo.dk/reports/customers
```

- Catch-all route: `src/app/api/yogo/[...path]/route.ts`
- Logic: `src/lib/yogo-proxy.ts`
- Suporta GET e POST
- Headers injectados automaticamente: Authorization, x-yogo-request-context, Origin
- Query params passados directamente
- Response devolvida sem transformacao

## Key Endpoints

### Reports (POST)

#### POST /reports/customers
Buscar clientes com filtros.

Filtros comuns:
- `hasMembershipOrClassPass: true` — subscritores activos
- `hasMembership: false, hasClassPass: false` — leads frios
- `hasNoSignupsInPeriod: { startDate, endDate }` — churn risk
- `hasClassPass: true, hasMembership: false` — trial sem conversao

#### POST /reports/memberships-list
Buscar memberships com filtros.

Filtros comuns:
- `status: ['active']` — memberships activas
- `status: ['ended'], endedReason: ['payment_failed']` — pagamentos falhados

### Classes (GET)

#### GET /classes
Query params:
- `startDate`, `endDate` — range de datas
- `populate[]=class_type` — incluir tipo de aula
- `populate[]=teachers` — incluir professores
- `populate[]=room` — incluir sala
- `populate[]=class_signup_statuses` — incluir estatisticas de inscritos

### Revenue (GraphQL)

#### POST /graphql
```graphql
query revenueReport($input: RevenueReportInput!) {
  revenueReport(input: $input) {
    label startDate endDate
    items {
      itemType itemId itemCount name
      totalExVat vat totalInclVat vatPercentage
      eventStartDate
    }
  }
}
```

Variables:
```json
{
  "input": {
    "periodType": "year",
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "dateFilterField": "paid",
    "vatFilter": null,
    "canHandleSeparateRefunds": true
  }
}
```

## Data Fetching Pattern (Client-side)

```typescript
const { fetchYogo, fetchReport, fetchGraphQL } = useYogoFetch();

// Generic GET
const data = await fetchYogo("classes?startDate=2026-01-01&populate[]=class_type");

// Report (POST + parseReport)
const customers = await fetchReport("reports/customers", { hasMembership: false });

// GraphQL
const revenue = await fetchGraphQL(query, { input: { ... } });
```

## Response Parsing

`parseReport()` em `utils.ts` normaliza varios formatos de response do Yogo:
- Arrays directos de objectos
- Arrays de arrays (header + rows)
- Objectos com `.data`, `.rows`, `.result`, `.results`, `.customers`, `.users`
- Column/row format (headers array + rows array)

Output: sempre `Record<string, unknown>[]`

## Related

- [[Arquitectura]] — proxy architecture
- [[Hooks-e-Utilities]] — useYogoFetch, parseReport
- [[Business-Constants]] — IDs usados nos filtros
- [[Gotchas]] — token expiry, USC leads filtering
