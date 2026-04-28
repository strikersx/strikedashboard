---
title: Striker's House Dashboard — Vault Index
type: index
---

# Striker's House Dashboard

Dashboard operacional para a academia de artes marciais em Carcavelos.
Ricardo (admin/dev) + Marcelo (operacoes) + Equipa vendas.

## Arquitectura & Stack

- [[Arquitectura]] — Stack, file structure, decisoes de design
- [[Design-System]] — Dark theme, cores, tipografia, spacing
- [[Componentes]] — StatCard, Pill, BarChart, DataTable, ClassList, Nav, Icons

## Modulos

- [[Auth-System]] — Login, cookies, roles, middleware
- [[Yogo-API]] — Proxy passthrough, endpoints, GraphQL revenue
- [[Hooks-e-Utilities]] — useAuth, useYogo, useDataFetch, useDashboard, utils.ts
- [[Paginas-Dashboard]] — Overview, Revenue, Funnel, Subscribers, PTs, Leads, Trials, Churn, Failed, Classes

## Referencia

- [[Business-Constants]] — Plan IDs, subscription IDs, plan values, color map
- [[Gotchas]] — Yogo token, Vercel+SQLite, USC leads, plan regex
- [[Roadmap]] — MVP + 4 sprints (WA audit, leads funnel, token refresh, WA Cloud API)

## Planos & Specs

- [[MVP-Implementation-Plan]] — 14 tasks, ~42 files, step-by-step
- [[Dashboard-v2-Design-Spec]] — Spec completa aprovada (2026-04-28)
