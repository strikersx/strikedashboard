---
title: WhatsApp Bot v1 — Reservar, Cancelar, Trial Follow-up
type: design
date: 2026-05-25
status: ready-for-implementation
supersedes: WhatsApp-Bot-Design.md (Sprint 4 original)
---

# WhatsApp Bot v1 — Design Spec

Implementação thin slice do bot WhatsApp da Striker's House. Substitui o âmbito original de Sprint 4 do [[Roadmap]] por uma versão menor que ignora os pré-requisitos de Sprints 1 e 3 (Audit WA, token Yogo auto-refresh), mas com disciplina de pre-slice gates + audit-first model.

**Este spec é o output do workflow development-workflow** (vault → karpathy → brainstorm 5-field → autoresearch:reason → acceptance criteria → search-before-create). Decidido contra o draft inicial; ver `reason/260525-0025-wa-bot-v1-plan-review/` para o trace adversarial completo (3 FATAL + 8 MAJOR weaknesses identificados e resolvidos).

## Acceptance Criteria (Scope / Metric / Direction / Verify)

| Field | Value |
|---|---|
| **Scope** | 3 fluxos pull (reserva, cancelar, fallback) + 1 cron diário trial follow-up. Turso. Kill switch via env var `WA_ENABLED`. GDPR 90d purge. **Sem** `/dashboard/chat` em v1. **Sem** PT signups (`/appointments` — fase 2). |
| **Metric** | (a) ≥10 reservas + ≥5 cancelamentos completos sem intervenção humana, distribuídos por ≥5 alunos distintos, em 1 semana corrida. (b) Taxa de erro Yogo <2%. (c) Cron follow-up entrega ≥75% (descontados `isNonActionableLead`). |
| **Direction** | Maximizar reservas/cancels bem-sucedidos. Minimizar `LOOKUP_MISS`, `HMAC_FAIL`, `SESSION_RACE`, `BOOKING_FAIL`. |
| **Verify** | Queries SQL contra Turso executáveis em ≤5min após semana de teste. Runbook documenta as queries. `/api/whatsapp/health` mostra contagens 24h. |

## Non-Goals (explicitamente fora)

- Auto-refresh do token Yogo (Sprint 3 dedicado; banner manual quando faltam <30 dias)
- Audit WA ↔ Yogo (Sprint 1 dedicado)
- Funil de leads / CRM Kanban (Sprint 2 dedicado)
- LLM para parse de comandos (keyword matching no v1)
- Personal Trainer signups (endpoint `/appointments` separado)
- Comandos `minhas aulas` e `plano` (v1.1)
- `/dashboard/chat` inbox (v1.1+)
- Cache pré-calculado de `yogoCustomerId` (coluna reservada em `WaContact` para v1.1 backfill; não populada em v1)

## Pre-slice gates (DEVEM fechar antes do código respectivo)

### G1 — Permanent WA System User token
Issuar token System User (não user token de 24h). **Verificação:** `curl https://graph.facebook.com/v21.0/me -H "Authorization: Bearer $WA_TOKEN"` retorna 200 ≥25h depois do issue. Sem este pré-requisito, o bot morre em produção a cada 24h.

### G2 — Phone normalisation spike (BLOQUEIA Slice 3)
Dump de `/reports/customers` (todos ~700 clientes). Esboçar `normalize()` em `src/lib/phone.ts`. **Aceitação:** ≥98% dos telemóveis mapeiam para uma única E.164. Resíduo manualmente triado e regra de normalização congelada. Sem este número documentado, **Slice 3 não arranca** — o lookup phone→customer é o sistema de identificação do bot.

### G3 — Meta template `trial_followup_pt` submetido
Categoria MARKETING, idioma `pt_PT`. Lead de aprovação 24-48h. **Slice 5 envia código mesmo se ainda pendente** — cron loga `TEMPLATE_PENDING` e faz no-op até aprovação. Copy proposto:

```
Olá {{1}}! 👊 Que tal a aula de ontem na Striker's House?
Se quiseres voltar, marca a próxima aqui — basta responder 'reserva'.
Temos um plano à tua medida quando quiseres falar.

Footer: Striker's House · Carcavelos
```

## Arquitectura

```
WhatsApp Cloud API (Meta)
        │
        │ webhook POST (com X-Hub-Signature-256)
        ▼
┌─────────────────────────────────────┐
│ POST /api/whatsapp/webhook          │
│  1. raw body via req.text()         │  ← raw-body.ts
│  2. HMAC verify timingSafeEqual     │  ← wa/verify.ts
│  3. upsert WaInbound metaId @unique │  ← dedupe BEFORE side effects
│  4. 200 OK em <50ms                 │
│  5. waitUntil(dispatch(...))        │
└──────────┬──────────────────────────┘
           │ dispatch loads WaSession (version optimistic lock)
           ▼
   ┌───────┴───────────────────────┐
   │ handlers (each returns {replies, nextState})
   │  • reservar.ts                │
   │  • cancelar.ts                │ ──▶ yogoFetch() ──▶ Yogo API
   │  • fallback.ts                │
   └───────────────────────────────┘

      (independente)

┌─────────────────────────────────────┐
│ GET /api/cron/trial-followup        │
│   Authorization: Bearer CRON_SECRET │
│   Schedules: 0 10 * * * AND         │
│              0 11 * * *             │
│   Early-exit unless Lisbon hour==11 │
└──────────┬──────────────────────────┘
           │
           ▼
   trials ontem (class_type=21792, checked_in_at!=null)
     filter isNonActionableLead
     dedupe (phoneE164, kind='trial_followup', dateKey)
     send template ou log TEMPLATE_PENDING

Persistência: Turso (libsql) via Prisma 7
  WaContact   identidade aluno (phoneE164 @id, yogoCustomerId? reservado para v1.1)
  WaInbound   mensagens recebidas (metaId @unique, body — purgado 90d)
  WaSession   estado conversa (5 estados, TTL 10min, version optimistic lock)
  WaOutbound  mensagens enviadas (kind, status, error)
  WaEvent     audit table (LOOKUP_MISS, HMAC_FAIL, BOOKING_OK, BOOKING_FAIL, CANCEL_OK, CANCEL_FAIL, SESSION_RACE, TEMPLATE_PENDING, YOGO_401, etc)
```

## Modelo de dados (Prisma + Turso)

```prisma
datasource db {
  provider          = "sqlite"   // local dev
  url               = env("DATABASE_URL")
}
// Em produção via Vercel Marketplace Turso integration:
//   DATABASE_URL=libsql://...turso.io
//   + DATABASE_AUTH_TOKEN configurados
//   + @prisma/adapter-libsql usado em db.ts

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

model WaContact {
  phoneE164      String   @id              // "+351912345678"
  yogoCustomerId Int?                       // reservado para v1.1 (NÃO populado em v1)
  firstSeenAt    DateTime @default(now())
  sessions       WaSession[]
  inbounds       WaInbound[]
  outbounds      WaOutbound[]
}

model WaInbound {
  id          String   @id @default(cuid())
  metaId      String   @unique              // dedupe Meta retries — write BEFORE side effects
  phoneE164   String
  body        String                        // texto cru; purgado por cron 90d
  receivedAt  DateTime @default(now())
  contact     WaContact @relation(fields: [phoneE164], references: [phoneE164])

  @@index([phoneE164, receivedAt])
}

model WaSession {
  phoneE164       String   @id
  state           String   @default("IDLE")  // IDLE | AWAIT_CLASS_PICK | AWAIT_CONFIRM_BOOK | AWAIT_CANCEL_PICK | AWAIT_CONFIRM_CANCEL
  pendingClassId  Int?
  pendingSignupId Int?
  expiresAt       DateTime?                   // TTL 10min
  version         Int      @default(0)        // optimistic lock — incrementa em cada transição
  updatedAt       DateTime @updatedAt
  contact         WaContact @relation(fields: [phoneE164], references: [phoneE164])
}

model WaOutbound {
  id          String   @id @default(cuid())
  phoneE164   String
  kind        String                          // "text" | "interactive_list" | "interactive_button" | "template"
  payload     String                          // JSON serializado
  status      String                          // "sent" | "failed" | "skipped_pending"
  error       String?                         // código Meta/Yogo se falhou
  templateKey String?                         // (phoneE164, kind='trial_followup', dateKey) — idempotência cron
  sentAt      DateTime @default(now())
  contact     WaContact @relation(fields: [phoneE164], references: [phoneE164])

  @@unique([phoneE164, templateKey])
  @@index([phoneE164, sentAt])
}

model WaEvent {
  id         String   @id @default(cuid())
  kind       String                            // LOOKUP_MISS | HMAC_FAIL | BOOKING_OK | BOOKING_FAIL | CANCEL_OK | CANCEL_FAIL | SESSION_RACE | TEMPLATE_PENDING | YOGO_401 | …
  phoneE164  String?
  meta       String?                           // JSON serializado (sem PII)
  createdAt  DateTime @default(now())

  @@index([kind, createdAt])
}
```

## Fluxos detalhados

### Reservar

1. Aluno: `reserva` / `reservar` / `marcar` / `agendar`
2. Lookup via `findCustomerByPhone(e164)` — miss → "Não te encontrámos. Escreve ao Marcelo." + `WaEvent kind=LOOKUP_MISS`
3. `GET /classes?startDate=hoje&endDate=amanhã&populate[]=class_type&populate[]=teachers&populate[]=signup_count` (replica `dashboard/trials/page.tsx:103`)
4. Filtra: aulas cheias OFF, aulas em que o aluno já está inscrito OFF
5. Render:
   - ≤10 → 1 interactive list (rows com `id=classId`)
   - >10 → headers `HOJE` / `AMANHÃ` + rows
   - Ainda >10 após split → mostra hoje + linha "Escreve `mais` para amanhã" (fallback texto)
6. Estado: `AWAIT_CLASS_PICK`, `version++`, `expiresAt = now+10min`
7. Aluno toca aula → `pendingClassId = classId`, `AWAIT_CONFIRM_BOOK`
8. Button confirm "Confirmas? Striking · hoje 19:30" `[Sim, reservar]` `[Cancelar]`
9. Sim → `POST /class-signups {user:"<id>", class:<id>, checked_in:false}` (user **string**)
10. Sucesso → "Reservado. Aparece 10min antes." + `WaEvent kind=BOOKING_OK`. Reset session a IDLE.
11. Falha → mapeia Yogo error:
    - `409` → "Já estás inscrito."
    - `403` → "Sem plano activo. Fala com o Marcelo."
    - `5xx` → "Tenta outra vez em 1min." + `WaEvent kind=BOOKING_FAIL`
12. Inbound mid-state → version-checked transition; conflito → log `SESSION_RACE`, descarta. Literais `cancelar`/`reserva` resetam para IDLE.

### Cancelar

1. Aluno: `cancelar`
2. `GET /class-signups?user=<id>&populate[]=class&startDate=hoje`, filtra `start > now+15min` (proibido cancel <15min antes da aula)
3. **0** → "Sem aulas marcadas."
4. **1** → button confirm directo "Cancelar Striking · hoje 19:30?" — confirmação **obrigatória** mesmo N=1
5. **2-10** → interactive list (rows com `id=signupId`)
6. **>10** → "Tens N marcações, escreve `DD/MM HH:MM`" — free-text fallback
7. Confirm → `DELETE /class-signups/{id}` → "Cancelado." + `WaEvent kind=CANCEL_OK`

### Fallback

Mensagem sem keyword E `state==IDLE`:
```
"Diz reserva para marcar uma aula ou cancelar para desmarcar."
```
Sem flag "needs human" em v1 — todas as conversas vão eventualmente para o WhatsApp humano do Marcelo (a Meta encaminha mensagens automaticamente).

### Cron trial follow-up

```
vercel.json:
  crons:
    - { path: "/api/cron/trial-followup", schedule: "0 10 * * *" }   # Verão Lisboa
    - { path: "/api/cron/trial-followup", schedule: "0 11 * * *" }   # Inverno Lisboa
```

Route:
1. Verifica `Authorization: Bearer ${CRON_SECRET}`
2. Lê hora local Lisboa via `Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Lisbon', hour:'numeric'})`. **Se hora ≠ 11, return 200 noop.** Garante exactamente 1 execução por dia em ambos os horários (Verão/Inverno).
3. `dateKey = ontem em YYYY-MM-DD (Europe/Lisbon)`
4. Yogo report: classes de ontem `class_type[]=21792`, expandir signups, filtrar `checked_in_at != null`
5. Filtrar `isNonActionableLead(customer)` (Gotcha #3 — USC/staff)
6. Para cada aluno restante:
   - Compor `templateKey = dateKey` (combinado com `phoneE164 + kind='trial_followup'` é único pelo `@@unique` em `WaOutbound`)
   - Tentar insert `WaOutbound`. Se duplicado (mesmo aluno + dateKey) → skip
   - Se template ainda pendente Meta → status=`skipped_pending` + `WaEvent kind=TEMPLATE_PENDING`
   - Senão → `POST graph.facebook.com/v21.0/<phone_id>/messages` com template, status=`sent`
7. Resposta: JSON com contagens (sent/skipped/failed)

## Estrutura de ficheiros

```
src/
├── app/
│   ├── api/
│   │   ├── whatsapp/webhook/route.ts       # GET handshake + POST eventos (público, HMAC-protected)
│   │   ├── cron/trial-followup/route.ts    # GET, Bearer CRON_SECRET
│   │   └── whatsapp/health/route.ts        # GET admin-gated, 24h WaEvent counts
│   └── (dashboard páginas existentes intocadas)
├── lib/
│   ├── db.ts                               # Prisma client singleton (libsql adapter quando DATABASE_PROVIDER=libsql)
│   ├── phone.ts                            # normalize() E.164, table-driven tests
│   ├── wa/
│   │   ├── meta.ts                         # sendText, sendList, sendButton, sendTemplate
│   │   ├── verify.ts                       # verifySignature(rawBody, header, secret) com crypto.timingSafeEqual
│   │   ├── raw-body.ts                     # readRawBody(req) — req.text() once
│   │   ├── parser.ts                       # keyword regex → intent
│   │   ├── session.ts                      # load/transition WaSession com version check
│   │   ├── render.ts                       # class → interactive list row (≤24/72c, ≤10 rows)
│   │   ├── dispatch.ts                     # orchestrator
│   │   └── handlers/
│   │       ├── reservar.ts
│   │       ├── cancelar.ts
│   │       └── fallback.ts
│   ├── yogo/
│   │   ├── fetch.ts                        # yogoFetch() — extraído de yogo-proxy.ts no Slice 1
│   │   ├── lookup.ts                       # findCustomerByPhone(e164) probes 3 variants
│   │   └── signups.ts                      # listClasses, listFutureSignups, createSignup, deleteSignup
│   ├── yogo-proxy.ts                       # passa a chamar yogoFetch() — sem mudar comportamento externo
│   ├── utils.ts                            # intocado (continua a expor isNonActionableLead, parseReport)
│   ├── constants.ts                        # intocado
│   └── auth.ts                             # intocado
prisma/
├── schema.prisma                            # 5 models WA + provider flip
└── migrations/<ts>_wa_v1/migration.sql
vitest.config.ts
tests/
├── lib/phone.test.ts
├── lib/wa/verify.test.ts
├── lib/wa/parser.test.ts
├── lib/wa/render.test.ts
├── lib/wa/session.test.ts                  # version optimistic lock
└── lib/yogo/lookup.test.ts                 # 3-variant probe
vercel.json                                  # 2 cron entries (Verão + Inverno)
.env.example                                 # + 9 chaves WA/Turso/Cron
```

## Slices (PRs)

### Slice 0 — Test infra + phone normaliser (~150 LOC)

- Instalar `vitest` + `@vitest/coverage-v8` (verificar `npm view vitest time.modified` ≥14d, Invariant #9)
- `vitest.config.ts`, `package.json` scripts: `test`, `test:watch`, `test:coverage`
- `src/lib/phone.ts` exporta `normalize(input: string): { e164: string, variants: string[] }`
- Tests table-driven: `+351 912 345 678`, `00351912345678`, `912345678`, `+351912345678`, `351912345678`, `(+351) 912-345-678`, foreign (`+55…`, `+44…`) passthrough, junk inputs
- **No production WA code.** Single PR, completamente revertível.

### Slice 1 — Turso provisioning + yogoFetch extraction (~80 LOC, ZERO features)

- Provisionar Turso via Vercel Marketplace (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`)
- `package.json` + `@libsql/client` + `@prisma/adapter-libsql` (verificar 14d)
- `prisma/schema.prisma` mantém models vazios mas adiciona `driverAdapters` preview feature
- `src/lib/db.ts` Prisma singleton com adapter libsql quando `DATABASE_PROVIDER=libsql`
- `npx prisma migrate dev --name init` (migration vazia)
- **Extrair `yogoFetch()` de `yogo-proxy.ts`**: `src/lib/yogo/fetch.ts` returns parsed JSON. `proxyToYogo()` passa a chamar `yogoFetch` e wrap em Response.
- **Smoke obrigatório:** `npm run build` + manual visit a cada `/dashboard/*` page em preview Vercel. Sem regressão.
- Rollback = single revert.

### Slice 2 — Webhook skeleton + audit (~250 LOC)

- 5 Prisma models + migration
- `src/lib/wa/raw-body.ts`: lê `req.text()` once, devolve string
- `src/lib/wa/verify.ts`: `verifySignature(rawBody, signatureHeader, appSecret)` usando `crypto.createHmac('sha256').update(rawBody)` + `timingSafeEqual`. Tests com fixture de payload Meta.
- `src/app/api/whatsapp/webhook/route.ts`:
  - `GET`: verify_token handshake
  - `POST`: raw body → HMAC verify (fail → 401 + `WaEvent HMAC_FAIL`) → upsert `WaInbound` por `metaId` (duplicate? → 200 noop) → 200 em <50ms → `waitUntil(echoHandler)` que devolve "echo: <body>"
- Tests: HMAC válido/inválido, dedupe metaId, raw-body roundtrip
- **Demo:** Marcelo manda "olá" → recebe "echo: olá" → linha em `WaInbound`

### Slice 3 — Reservar flow (~350 LOC, feature flag `WA_FLOW_RESERVAR=true`)

**Bloqueado por G2** (phone normalisation gate fechado).

- `src/lib/yogo/lookup.ts`: `findCustomerByPhone(e164)` chama `/customers?phone=<variant>` para cada variant da phone.ts até hit. Miss → `WaEvent LOOKUP_MISS`
- `src/lib/yogo/signups.ts`: `listClasses(from, to)`, `createSignup(userId, classId)`
- `src/lib/wa/session.ts`: `loadSession(phone)`, `transition(session, nextState, patch)` com version optimistic lock (`UPDATE … WHERE version = $current`)
- `src/lib/wa/render.ts`: `renderClassList(classes)` → WA list payload (≤24/72/10)
- `src/lib/wa/handlers/reservar.ts` + `dispatch.ts`
- Tests: parser keywords, render >10 split, session race detect, Yogo error mapping (409/403/5xx)
- **Demo:** aluno reserva, vê confirmação, aula aparece no Yogo

### Slice 4 — Cancelar flow (~200 LOC)

- `src/lib/yogo/signups.ts`: `+listFutureSignups(userId)`, `+deleteSignup(signupId)`
- `src/lib/wa/handlers/cancelar.ts`
- Logic: N=0/1/2-10/>10 (free-text DD/MM HH:MM parser)
- Confirmação **obrigatória** mesmo N=1
- Cutoff `start_time > now+15min` (não cancela em cima da hora)
- Tests: cada cardinality + DD/MM parser + 15min cutoff

### Slice 5 — Trial follow-up cron (~150 LOC)

**G3 submetido antecipadamente.**

- `vercel.json` 2 entries (10 UTC + 11 UTC)
- `src/app/api/cron/trial-followup/route.ts`: bearer auth → Lisbon hour check → query Yogo → `isNonActionableLead` filter → dedupe via `WaOutbound @@unique` → send template OR log `TEMPLATE_PENDING`
- Tests: Lisbon hour gate (Verão/Inverno mock), `isNonActionableLead` integration, idempotência (re-run sem duplicar), template pending no-op
- Adicionar cron `WaInbound` purge: novo `/api/cron/wa-purge` `0 3 * * *` → `DELETE FROM WaInbound WHERE receivedAt < now-90d` (GDPR)

### Slice 6 — Kill switch + health endpoint (~80 LOC)

- `WA_ENABLED=false` env → webhook POST devolve 200 sem dispatch (silent ack-only)
- `src/app/api/whatsapp/health/route.ts`: admin-gated (via cookie check do `auth.ts`), retorna `{ last24h: { kind: count, ... }, sessions: { active, expired }, queue: ... }`
- Banner no `/dashboard` quando `WA_ENABLED=false` (1 linha em `app-header.tsx`)
- Runbook documento (apêndice deste spec)

**Total: ~1260 LOC em 7 PRs.**

## Setup Vercel / Meta

**Pre-deploy (manual):**

| # | O quê | Onde |
|---|---|---|
| 1 | Validar `WA_ACCESS_TOKEN` é System User permanent (G1) | curl `/me` 25h depois |
| 2 | Phone spike (G2) | `/reports/customers` dump + `npx tsx scripts/phone-spike.ts` (Slice 0 deliverable) |
| 3 | Submeter template `trial_followup_pt` (G3) | WhatsApp Manager → Message Templates |
| 4 | Turso Marketplace install | Vercel dashboard → Storage → Browse Marketplace |
| 5 | Meta Developers webhook config | URL `https://<prod>/api/whatsapp/webhook`, verify token igual a `WA_VERIFY_TOKEN`, subscribe `messages` |
| 6 | Copiar `WA_APP_SECRET` | Meta Developers → App → Settings → Basic |

**Env vars:**

```
# WhatsApp (Meta credentials já confirmadas)
WA_PHONE_NUMBER_ID=1148538915006619
WA_BUSINESS_ACCOUNT_ID=1699574434508093
WA_ACCESS_TOKEN=<System User token>
WA_APP_SECRET=<from Meta>
WA_VERIFY_TOKEN=<random secret>
WA_TEMPLATE_TRIAL_FOLLOWUP=trial_followup_pt
WA_ENABLED=true

# Cron
CRON_SECRET=<random>

# Turso (auto-provisionado pelo Marketplace, mas confirmar)
DATABASE_PROVIDER=libsql
DATABASE_URL=libsql://...turso.io
DATABASE_AUTH_TOKEN=<from Turso>
```

## Auth & segurança

- Webhook é público — autenticação via HMAC X-Hub-Signature-256 contra `WA_APP_SECRET`. Falha → 401, grava `WaEvent HMAC_FAIL`.
- Cron é Bearer-gated por `CRON_SECRET` (Vercel injecta header automaticamente quando definido).
- `/api/whatsapp/health` herda cookie auth admin (via `src/lib/auth.ts`).
- HMAC raw body: `req.text()` chamado uma única vez em `raw-body.ts`. Passa-se a string raw para `verifySignature` E para `JSON.parse`. Next.js App Router exige isto — `req.json()` consome o body stream.
- `WaInbound.body` purgado aos 90d via cron (`WA-purge`).
- Sem PII em `WaEvent.meta` — só códigos e IDs.

## Riscos (12, ranked P/I)

| # | Risk | P/I | Mitigation |
|---|---|---|---|
| 1 | Phone normalisation gaps → lookup miss | H/H | G2 gate bloqueia Slice 3. 3-variant probe. Weekly review de `LOOKUP_MISS` |
| 2 | Turso/libsql vs Prisma 7 friction | M/M | Slice 1 só migration. Build smoke todas as pages. Single revert |
| 3 | Meta retries duplicate bookings | H/H | `WaInbound.metaId @unique` BEFORE side effects. Ack <50ms. Processing em `waitUntil` |
| 4 | Yogo cold-start >Meta retry window | M/M | Ack precede processing. Errors mapeados, não retried automaticamente |
| 5 | DST flip skips/doubles cron | M/H | 2 cron entries (10/11 UTC) + `Europe/Lisbon` early-exit + `WaOutbound` unique key por dateKey |
| 6 | Template Meta rejeitado/delayed | M/M | G3 submete cedo. Cron loga `TEMPLATE_PENDING` e no-ops se ainda pendente |
| 7 | HMAC + App Router raw body | M/H | `raw-body.ts` chama `req.text()` once. JSON.parse da mesma string. Fixture-tested com payload Meta |
| 8 | Cancelar a aula errada | L/H | Confirmação obrigatória mesmo N=1. `start_time > now+15min` cutoff |
| 9 | Lookup latency sem cache | M/L | Aceite v1. `WaContact.yogoCustomerId` reservado para v1.1 backfill |
| 10 | Yogo token expira Out/2026 | L/H | Out of scope (Sprint 3). `WaEvent YOGO_401` alerta cedo |
| 11 | GDPR retention | M/M | `WaInbound.body` purga 90d via cron. Sem PII em `WaEvent.meta`. Runbook |
| 12 | State desync rapid messages | M/M | `WaSession.version` optimistic lock. Conflito → discard older + log `SESSION_RACE` |

## Unknowns to resolve mid-slice

- Yogo error code exacto para "no active membership" no `createSignup` (drive Slice 3 copy)
- `/customers?phone=` aceita partial ou requer E.164 exacta (drive Slice 3 probe order)
- `signups.checked_in_at` vs `signups.attended` qual é o marker de trial-attendance (drive Slice 5 filter)

## Custos

| Item | Custo |
|---|---|
| Mensagens inbound | €0 |
| Outbound 24h window | €0 |
| Template `trial_followup_pt` (marketing) | ~€0.05-0.10 por envio |
| Cron 1x/dia × ~5-10 trials/dia | <€20/mês |
| Turso | free tier (até 500 DBs, 9GB storage, 1B row reads/mês — folgado) |
| Vercel Cron | incluído |

## Verification plan (Step 4 — tests)

Vitest harness corre em CI (Vercel build). Suites:

- `tests/lib/phone.test.ts` — 25+ casos table-driven
- `tests/lib/wa/verify.test.ts` — HMAC válido/inválido, timing-safe, payload Meta real
- `tests/lib/wa/parser.test.ts` — keywords reservar/cancelar/literais reset
- `tests/lib/wa/render.test.ts` — list size limits, day split
- `tests/lib/wa/session.test.ts` — version conflict, TTL expiry
- `tests/lib/yogo/lookup.test.ts` — 3-variant probe, miss → LOOKUP_MISS event

Coverage target ≥80% para `src/lib/phone.ts`, `src/lib/wa/*`, `src/lib/yogo/lookup.ts`. Routes (`/api/whatsapp/webhook`, `/api/cron/*`) testados via integration tests com Prisma in-memory.

Build smoke (Slice 1 e cada slice subsequente): `npm run build` + visit manual a cada `/dashboard/*` page em preview Vercel.

## Runbook (apêndice — produzido na Slice 6)

Queries SQL para o Marcelo verificar saúde do bot. Localização: `docs/runbooks/wa-bot.md`.

```sql
-- últimos 7 dias de bookings
SELECT date(createdAt), kind, count(*) FROM WaEvent
WHERE kind IN ('BOOKING_OK','BOOKING_FAIL','CANCEL_OK','CANCEL_FAIL')
  AND createdAt > date('now','-7 days')
GROUP BY 1, 2 ORDER BY 1 DESC;

-- lookup misses (pessoas que escreveram mas não foram identificadas)
SELECT phoneE164, count(*) FROM WaEvent
WHERE kind='LOOKUP_MISS' AND createdAt > date('now','-30 days')
GROUP BY 1 ORDER BY 2 DESC;

-- trial follow-up entrega ontem
SELECT status, count(*) FROM WaOutbound
WHERE templateKey = strftime('%Y-%m-%d', 'now', '-1 day')
GROUP BY 1;
```

## Related

- [[WhatsApp-Bot-Design]] — design original (Sprint 4 completo)
- [[Roadmap]] — Sprint 4 substituído; Sprints 1 e 3 adiados
- [[Yogo-API]] — endpoints `/classes`, `/class-signups`, `/customers`
- [[Gotchas]] — #1 token expiry, #2 Vercel+SQLite, #3 USC filter
- `reason/260525-0025-wa-bot-v1-plan-review/` — adversarial review trace
