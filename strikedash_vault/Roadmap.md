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
- Decisao 2026-05-17: instalar Turso via **Vercel Marketplace** (auto-provision de env vars). Adiado ate ao arranque deste sprint — MVP nao escreve em DB.

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

## Sprint 4 — WhatsApp Cloud API (Bot de Reservas)

Redesenhado 2026-05-17 -- abordagem **pull-based** (aluno inicia conversa, bot responde). Spike Yogo signup API confirmado: POST/DELETE `/class-signups` funcionam. Spec completa em [[WhatsApp-Bot-Design]].

**Comando principal:**
- Aluno digita "reserva" -> bot responde com list message (hoje + amanha) -> aluno toca aula -> confirma -> Yogo POST

**Outros comandos:**
- "cancelar" -> lista inscricoes activas -> cancela
- "minhas aulas" -> proximas inscricoes
- "plano" -> sessoes restantes, proximo pagamento

**Schema Prisma:**
- `WaConversation` -- state machine por nº (pending intent + pendingClassId + TTL)
- `WaMessage` -- historico in/out

**Nova page:**
- `/dashboard/chat` -- inbox para o Marcelo ver historico das conversas

**Features:**
- Webhook receiver Meta WhatsApp
- Parser de comandos (keywords + LLM Haiku fallback opcional)
- Filtro de aulas pelo plano do aluno (resolve limite Meta de 10 items por list)
- Inscricao automatica via `POST /class-signups` (Yogo escolhe pass/membership)
- Cancelamento via `DELETE /class-signups/{id}`
- Cloudflare Tunnel para webhook publico (dev)
- Pushes seletivos opcionais: lembrete 30min antes (utility template) -- custo ~EUR 20/mes

**Custo Meta:** EUR 0/mes em pull. Pushes seletivos opcionais ~EUR 20/mes para 150 alunos.

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
