---
title: MVP Implementation Plan
type: reference
---

# MVP Implementation Plan

> Plano detalhado em `docs/superpowers/plans/2026-04-28-mvp-implementation.md`

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 14 |
| Total files | ~42 |
| Total commits | 14 |

## Tasks

| # | Task | Files | Descricao |
|---|------|-------|-----------|
| 1 | Project Scaffolding | 9 | Next.js 15, Tailwind, Prisma, TypeScript setup |
| 2 | Constants & Utilities | 2 | Business constants, date/currency/plan helpers |
| 3 | Auth Backend | 3 | auth.ts, API route, middleware |
| 4 | Yogo Proxy | 2 | yogo-proxy.ts, catch-all API route |
| 5 | Shared Components | 8 | Icons, StatCard, Pill, PaymentBadge, MiniStat, BarChart, DataTable, ClassList |
| 6 | Login Page + Auth Hook | 2 | useAuth hook, login page UI |
| 7 | Yogo Fetch Hook | 1 | useYogoFetch, useDataFetch |
| 8 | Dashboard Layout + Nav | 2 | Nav component, dashboard layout with context |
| 9 | Overview Page | 1 | Admin overview + Sales home (largest page) |
| 10 | Revenue Page | 1 | GraphQL revenue, bar chart, breakdowns |
| 11 | Funnel Page | 1 | 3-stage conversion funnel |
| 12 | Remaining Pages | 7 | Subscribers, PTs, Leads, Trials, Churn, Failed, Classes |
| 13 | Trial No-Conv Page | 2 | Trial without conversion + nav update |
| 14 | Final Polish | 1 | Root redirect, full build, test flow |

## Implementation Order

Tasks 1-8 sao sequenciais (cada um depende do anterior).
Tasks 9-13 podem ser parallelizadas apos Task 8.
Task 14 e o final.

## Key Decisions

- Task 9 (Overview) e a pagina mais complexa — combina admin + sales view em 1 ficheiro
- Task 12 agrupa 7 paginas num unico task — todas seguem o mesmo pattern
- Cada task termina com verify build + commit

## Related

- [[Dashboard-v2-Design-Spec]] — spec completa
- [[Arquitectura]] — file structure target
- [[Roadmap]] — MVP e o primeiro sprint
