---
title: Roadmap
type: reference
---

# Roadmap

## MVP — Dashboard Base

Migrar dashboard single-file Python para Next.js 15. Replicar toda a funcionalidade actual.

**Status:** Em implementacao (14 tasks, ~42 files)

**Includes:**
- Auth com senhas fixas + cookie httpOnly
- Proxy passthrough para Yogo API
- Todas as pages: Overview, Revenue, Funnel, Subscribers, PTs, Leads, Trials, Churn, Failed, Classes
- Componentes custom: StatCard, Pill, BarChart, DataTable, ClassList, Nav
- Dark theme, mobile-first
- Deploy na Vercel

**Plan:** [[MVP-Implementation-Plan]]

---

## Sprint 1 — Auditoria WhatsApp <-> Yogo

Cruzar contactos WhatsApp com clientes Yogo para identificar quem falta no sistema.

**Schema Prisma:**
- `WaContact` — contactos consolidados WhatsApp
- `WaImport` — historico de imports
- `YogoSyncRun` — runs de sincronizacao

**Nova page:** `/dashboard/audit`

**API routes:**
- `GET /api/audit/buckets`
- `GET /api/audit/contacts`
- `POST /api/audit/contacts/[phone]/resolve`
- `POST /api/audit/sync-yogo`

**Features:**
- Import de Excel/CSV para DB
- Classificacao automatica em 5 buckets: to_add, to_remove, lead_candidate, confirmed, noise
- Cruzamento com Yogo por telefone normalizado
- UI com tabs, seleccao multipla, export CSV, copiar telefones

**Prerequisito:** Migrar SQLite para Turso (Vercel read-only)

---

## Sprint 2 — Funil de Leads Completo

CRM basico com Kanban e tracking de leads.

**Schema Prisma:**
- `Lead` — estados: new -> contacted -> trial_scheduled -> trial_done -> negotiating -> converted -> lost
- `LeadHistory` — auditoria de mudancas

**Novas pages:**
- `/dashboard/leads/kanban` — vista Kanban com drag-drop
- `/dashboard/leads/table` — vista tabela com filtros

**Features:**
- CRUD de leads com validacao de duplicados
- Kanban com drag-drop nativo (HTML5, sem libs)
- Migration automatica de wa_contacts -> leads
- Auto-sync com Yogo (lead que paga = auto-converted)
- Painel detalhe slide-in com historico

---

## Sprint 3 — Token Yogo Sempre Activo

Auto-refresh do token Yogo antes de expirar.

**Schema Prisma:**
- `TokenEvent` — log de refreshes

**Config:** `~/.strikers/config.json` (secrets fora do codigo)

**Features:**
- Refresh automatico (API ou Playwright fallback)
- Banner global no header: verde (OK), amarelo (expira em breve), vermelho (expirado)
- Pagina `/dashboard/admin/token` com logs e accoes manuais
- Scheduler com retry e backoff

---

## Sprint 4 — WhatsApp Cloud API

Integrar WhatsApp Business API para messaging directo.

**Schema Prisma:**
- `WaMessage` — mensagens in/out
- `WaTemplate` — templates aprovados Meta
- `Broadcast` — campanhas de mensagens
- `GroupInvitation` — convites ao grupo

**Novas pages:**
- `/dashboard/chat` — caixa de entrada estilo WhatsApp Web
- `/dashboard/broadcasts` — campanhas manuais

**Features:**
- Webhook receiver para Meta WhatsApp
- Envio de templates aprovados
- Auto-convite ao grupo para novos clientes Yogo
- Auto-transitions de leads baseadas em mensagens
- Cloudflare Tunnel para webhook publico

---

## Timeline

| Sprint | Descricao | Prerequisitos |
|--------|-----------|---------------|
| MVP | Dashboard base Next.js | — |
| Sprint 1 | Auditoria WA | MVP + Turso |
| Sprint 2 | Funil de Leads | Sprint 1 |
| Sprint 3 | Token auto-refresh | MVP |
| Sprint 4 | WhatsApp Cloud API | Sprint 2 + Sprint 3 |

## Related

- [[MVP-Implementation-Plan]] — plano detalhado do MVP
- [[Dashboard-v2-Design-Spec]] — spec completa
- [[Arquitectura]] — stack e decisoes
- [[Gotchas]] — limitacoes que sprints resolvem
