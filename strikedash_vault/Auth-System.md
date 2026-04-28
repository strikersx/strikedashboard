---
title: Auth System
type: technical
---

# Auth System

## Overview

Autenticacao simples com senhas fixas no `.env.local`. Sem signup, recovery, OAuth.

## Flow

1. User entra password em `/login`
2. `POST /api/auth` valida contra `ADMIN_PWD` / `SALES_PWD`
3. Se valido: cria cookie httpOnly com role (`admin` | `sales`)
4. Middleware intercepta `/dashboard/*` e valida cookie
5. Se invalido: redirect para `/login`
6. Logout: `DELETE /api/auth` limpa cookie

## Cookie Config

| Propriedade | Valor |
|-------------|-------|
| Name | `striker_session` |
| Value | `"admin"` ou `"sales"` |
| HttpOnly | `true` |
| Secure | `true` em prod |
| SameSite | `lax` |
| MaxAge | 7 dias (604800s) |
| Path | `/` |

## API Endpoints

### POST /api/auth — Login
- Request: `{ password: string }`
- Success: `{ role: "admin" | "sales" }` + set cookie
- Fail: `{ error: "senha invalida" }` (401)

### GET /api/auth — Check Session
- Authenticated: `{ role: "admin" | "sales" }`
- Not authenticated: `{ error: "not authenticated" }` (401)

### DELETE /api/auth — Logout
- Response: `{ ok: true }` + clear cookie

## Roles & Permissions

| Role | Full Access | No Access |
|------|-------------|-----------|
| `admin` | Todas as paginas e dados | — |
| `sales` | Funil, Leads, Trials, Classes, Dashboard | Revenue, Churn, Failed, Subscribers, PTs |

### Route Visibility

```typescript
SALES_VISIBLE_ROUTES = [
  "/dashboard", "/dashboard/funnel", "/dashboard/leads",
  "/dashboard/trials", "/dashboard/classes"
]

ADMIN_ONLY_ROUTES = [
  "/dashboard/revenue", "/dashboard/churn", "/dashboard/failed",
  "/dashboard/subscribers", "/dashboard/pts"
]
```

## Middleware (`src/middleware.ts`)

- Protege todas as rotas `/dashboard/*`
- Sem sessao valida -> redirect `/login`
- Sales em rota admin-only -> redirect `/dashboard`
- User logado em `/login` -> redirect `/dashboard`

## Files

| File | Responsibility |
|------|----------------|
| `src/lib/auth.ts` | validatePassword, createSession, getSession, deleteSession |
| `src/app/api/auth/route.ts` | POST/GET/DELETE handlers |
| `src/middleware.ts` | Auth guard + role routing |
| `src/hooks/use-auth.ts` | Client-side auth state hook |
| `src/app/login/page.tsx` | Login UI |

## Related

- [[Arquitectura]] — file structure
- [[Hooks-e-Utilities]] — useAuth hook details
