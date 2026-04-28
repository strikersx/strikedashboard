---
title: Hooks e Utilities
type: technical
---

# Hooks e Utilities

## Hooks

### useAuth (`src/hooks/use-auth.ts`)

Auth state management no client.

```typescript
{
  role: "admin" | "sales" | null   // current role
  loading: boolean                  // true while checking session
  login(password): Promise<{ role } | { error }>
  logout(): Promise<void>          // clears cookie, redirects to /login
  isAdmin: boolean                  // shortcut for role === "admin"
}
```

- Check session on mount via `GET /api/auth`
- Login via `POST /api/auth`
- Logout via `DELETE /api/auth` + `window.location.href = "/login"`

### useYogoFetch (`src/hooks/use-yogo.ts`)

Wrapper para fetch ao proxy Yogo.

```typescript
{
  fetchYogo(path, options?): Promise<any>           // generic GET/POST to /api/yogo/*
  fetchReport(path, body): Promise<Record[]>         // POST + parseReport()
  fetchGraphQL(query, variables): Promise<any>       // POST to /api/yogo/graphql
}
```

- `fetchYogo` — fetch generico com Content-Type JSON
- `fetchReport` — POST com body + normaliza response via `parseReport()`
- `fetchGraphQL` — caso especial para endpoint GraphQL

### useDataFetch<T> (`src/hooks/use-yogo.ts`)

State management generico para async data fetching.

```typescript
{
  data: T | null
  loading: boolean
  error: string | null
  refetch(): Promise<void>
}
```

- Accepts fetcher function
- Manages loading/error/data states
- Refetch resets loading and calls fetcher again

### useDashboard (`src/app/dashboard/layout.tsx`)

Context hook para estado partilhado do dashboard.

```typescript
{
  refreshKey: number          // incremented on refresh button click
  lastFetch: Date | null      // last data fetch timestamp
  setLastFetch(date): void
}
```

- `refreshKey` usado como dependency em useEffect para trigger refetches
- `lastFetch` mostrado no nav header

## Utility Functions (`src/lib/utils.ts`)

### Date Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `fmtDate(d)` | `"YYYY-MM-DD"` | Format date |
| `getToday()` | `"YYYY-MM-DD"` | Today |
| `getWeekEnd()` | `"YYYY-MM-DD"` | Today + 6 days |
| `getMonthEnd()` | `"YYYY-MM-DD"` | End of current month |
| `getDashboardRange()` | `{startDate, endDate}` | Today to max(week end, month end) |
| `getLast30Days()` | `{startDate, endDate}` | Last 30 days range |
| `isToday(dateStr)` | `boolean` | Check if date is today |
| `isThisWeek(dateStr)` | `boolean` | Check if date is this week |
| `isThisMonth(dateStr)` | `boolean` | Check if date is this month |
| `daysUntil(dateStr)` | `number \| null` | Days from today to date |
| `monthLabel(m)` | `"Jan"`, `"Fev"`, etc. | Portuguese month label |

### Currency

| Function | Returns | Description |
|----------|---------|-------------|
| `eur(n)` | `"EUR1.234"` | Portuguese locale, no decimals |

### Plan Classification

| Function | Returns | Description |
|----------|---------|-------------|
| `getPlan(desc)` | plan name | Classify membership_description to PLAN_ORDER |
| `isPTPlan(plan)` | `boolean` | Check if plan starts with "PT" |

### Lead Filtering

| Function | Returns | Description |
|----------|---------|-------------|
| `isNonActionableLead(customer)` | `boolean` | Filter USC + internal email leads |

### Data Parsing

| Function | Returns | Description |
|----------|---------|-------------|
| `parseReport(response)` | `Record[]` | Normalize any Yogo response format to flat array |

## Related

- [[Yogo-API]] — endpoints consumed by hooks
- [[Auth-System]] — useAuth details
- [[Business-Constants]] — constants used by utils
