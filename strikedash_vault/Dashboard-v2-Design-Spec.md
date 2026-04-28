---
title: Dashboard v2 Design Spec
type: reference
---

# Dashboard v2 Design Spec

> Spec completa em `docs/superpowers/specs/2026-04-28-dashboard-v2-design.md`

## Resumo

Migracao do dashboard single-file Python para **Next.js 15** (App Router) com **SQLite/Prisma**, deploy na **Vercel**. MVP replica funcionalidade actual; sprints seguintes adicionam auditoria WA, funil de leads, token refresh e WhatsApp Cloud API.

## Status

**Aprovada** em 2026-04-28.

## Scope

### MVP
- Auth (senhas fixas, cookie httpOnly, roles admin/sales)
- Yogo proxy passthrough (zero transformacao)
- 11 dashboard pages
- 8 shared components
- 3 hooks
- 4 lib modules
- Prisma/SQLite config (vazio no MVP)

### Post-MVP
- Sprint 1: Auditoria WhatsApp
- Sprint 2: Funil de Leads (Kanban + CRUD)
- Sprint 3: Token Yogo auto-refresh
- Sprint 4: WhatsApp Cloud API

## Key Architecture Decisions

1. **Monorepo Next.js** em vez de API + UI separados
2. **Proxy passthrough** em vez de sync periodico
3. **Senhas fixas** em vez de NextAuth
4. **SQLite local** (MVP) -> **Turso** (prod)
5. **Custom Tailwind** em vez de UI library

## References

- [[Arquitectura]] — detalhes da stack
- [[MVP-Implementation-Plan]] — plano de implementacao
- [[Roadmap]] — timeline completa
- Spec completa: `docs/superpowers/specs/2026-04-28-dashboard-v2-design.md`
