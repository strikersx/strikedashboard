# Candidate A — WhatsApp Bot v1 Plan (initial brainstorm)

## 1. Goal

V1 do bot WhatsApp da Striker's House: aluno pode (a) escrever "reserva" no WA e marcar uma aula de hoje/amanhã sem intervenção humana; (b) escrever "cancelar" e desmarcar uma inscrição futura sua. E todos os dias às 11h00 Lisboa, alunos que tiveram check-in confirmado numa aula trial no dia anterior recebem uma mensagem template de follow-up no WA. Done = um aluno real reserva e cancela com sucesso em produção, e um trial real recebe o follow-up.

## 2. Files likely to change

**Novos:**
- `prisma/schema.prisma` — models WaConversation, WaMessage, WaSentTemplate
- `prisma/migrations/<ts>_wa_v1/migration.sql`
- `src/lib/wa/meta.ts` — cliente HTTP Meta (sendText/sendList/sendButton/sendTemplate)
- `src/lib/wa/verify.ts` — HMAC X-Hub-Signature-256
- `src/lib/wa/parser.ts` — keyword regex → intent
- `src/lib/wa/handlers/reservar.ts`
- `src/lib/wa/handlers/cancelar.ts`
- `src/lib/wa/handlers/fallback.ts`
- `src/lib/wa/dispatch.ts` — orchestrator (carrega WaConversation, escolhe handler, grava resposta)
- `src/lib/yogo/signups.ts` — wrappers tipados Yogo (listClassesWindow, listUserSignups, createSignup, deleteSignup, findCustomerByPhone)
- `src/lib/prisma.ts` — singleton Prisma client
- `src/app/api/whatsapp/webhook/route.ts` — GET handshake + POST eventos
- `src/app/api/cron/trial-followup/route.ts`
- `vercel.json` — cron schedule
- `.env.example` — adicionar 6 chaves WA + 1 CRON_SECRET + Turso vars

**Editar:**
- `src/lib/yogo-proxy.ts` — extrair yogoFetch() helper para reuso
- `package.json` — adicionar @libsql/client + @prisma/adapter-libsql (Turso). Adicionar vitest.
- `prisma/schema.prisma` — mudar provider para Turso adapter

## 3. Existing patterns found

- `src/lib/yogo-proxy.ts` — injecção de token/origin/headers
- `parseReport()` em `src/lib/utils.ts:115` — normaliza response Yogo
- `isNonActionableLead()` em `src/lib/utils.ts:108` — filtro USC/staff (Gotcha #3)
- Filtro `trialAttended` em `src/app/dashboard/page.tsx:105` — query exacta para trial follow-up cron
- `TRIAL_CLASS_TYPE_ID + TRIAL_CLASS_PASS_ID` em `src/lib/constants.ts`

## 4. Smallest implementation plan — 4 slices

**Slice 0 — Infra de testes (~50 LOC)**
- vitest + scripts test/typecheck
- 1 teste smoke (passa) para validar setup

**Slice 1 — Webhook handshake + echo (~150 LOC)**
- Prisma + Turso ligado (1 migration vazia para validar Turso)
- /api/whatsapp/webhook GET (verify_token) + POST (HMAC valida, grava mensagem, responde "echo: <texto>")
- src/lib/prisma.ts, src/lib/wa/meta.ts (só sendText), src/lib/wa/verify.ts

**Slice 2 — Comando "reserva" + "cancelar" (~300 LOC)**
- WaConversation model + state machine
- src/lib/yogo/signups.ts (4 funções)
- Handlers reservar, cancelar, fallback
- Dispatch orquestrador

**Slice 3 — Cron trial follow-up (~150 LOC)**
- WaSentTemplate model + idempotência
- /api/cron/trial-followup com Bearer CRON_SECRET
- vercel.json cron 0 10 * * *
- Template trial_followup_pt submetido à Meta (manual)

Total ~650 LOC distribuídas em 4 PRs.

## 5. Risks & unknowns

| # | Risco | P | I | Mitigação |
|---|---|---|---|---|
| 1 | WA_ACCESS_TOKEN é user token de 24h, não System User token | M | A | Validar antes do Slice 1 com curl graph.facebook.com/v21.0/me |
| 2 | Yogo armazena telemóveis sem normalização | A | A | Spike no Slice 1 com 3 alunos conhecidos |
| 3 | Yogo POST /class-signups error codes não-documentados | A | M | Tentar 3 cenários manualmente antes do Slice 2 |
| 4 | Projecto não tem infra de testes | C | A | Slice 0 instala vitest |
| 5 | Webhook >500ms da Meta retenta → duplicação | B | M | metaId @unique + waitUntil() se Yogo lento |
| 6 | Token Yogo expira Out/2026 → silent fail | C | A | Separar — Sprint 3 dedicado |
| 7 | Template Meta demora 24-48h aprovação | C | B | Cron faz no-op até aprovado |
| 8 | Aluno responde ao template → cai no fallback genérico | M | M | Aceitável v1 — gap documentado |
| 9 | Turso 1-click pode não correr suave | B | M | Validar localmente; Neon Postgres como plano B |
| 10 | @libsql/client lança versões frequentes | B | B | npm view time.modified ≥14 dias antes |

## Decisões já fixas

- Persistência: Turso
- Comandos v1: reserva + cancelar (read-only minhas/plano e LLM fallback ficam para depois)
- Cron trial follow-up: automático, 11h00 Lisboa
- Inbox /dashboard/chat e needsHuman flag: REMOVIDOS de v1 (scope cut por Karpathy)
- Cache yogoCustomerId 24h: REMOVIDO de v1 (premature)
- Testes: vitest + testes mínimos para módulo WA (Slice 0)
- Token Yogo banner: separado para sprint dedicado
- /dashboard/chat: NÃO aplicável (removido)
