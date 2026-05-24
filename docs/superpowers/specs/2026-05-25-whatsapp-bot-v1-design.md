---
title: WhatsApp Bot v1 — Reservar, Cancelar, Trial Follow-up
type: design
date: 2026-05-25
status: approved-for-planning
---

# WhatsApp Bot v1 — Design Spec

Implementação **thin slice** do bot WhatsApp da Striker's House. Cobre o fluxo de reserva/cancelamento via WA pull-based e um cron diário de follow-up a alunos que fizeram trial no dia anterior.

Substitui o âmbito original de Sprint 4 do [[Roadmap]] por uma versão menor que ignora os pré-requisitos de Sprints 1 e 3 (Audit WA, token auto-refresh). Persistência mínima vai directamente para Turso.

## Goals

- Aluno escreve "reserva" no WA → bot lista aulas → aluno escolhe → bot inscreve via Yogo
- Aluno escreve "cancelar" → bot lista inscrições → aluno escolhe → bot cancela via Yogo
- Mensagens fora destes comandos respondem com prompt + marcam conversa para humano (Marcelo vê no dashboard)
- Todos os dias às 11h00 Lisboa, mandar template "trial_followup_pt" aos alunos que tiveram check-in numa aula trial no dia anterior

## Non-Goals (explicitamente fora)

- Auto-refresh do token Yogo (continua manual, banner de aviso quando faltam <30 dias)
- Audit WA <-> Yogo (Sprint 1 original, separado)
- Funil de leads / CRM Kanban (Sprint 2 original, separado)
- LLM para parse de comandos (keyword matching no v1; Haiku fallback se houver falsos negativos depois)
- Personal Trainer signups (endpoint `/appointments` separado, fase 2)
- Comandos `minhas aulas` e `plano` (read-only, ficam para v1.1)

## Arquitectura

```
WhatsApp Cloud API (Meta)
        │
        │ webhook POST                          ┌── reserva: lista hoje+amanhã, escolhe, confirma
        ▼                                        │
┌───────────────────────────────┐  comandos     ├── cancelar: lista activas, escolhe, confirma
│ POST /api/whatsapp/webhook    │ ─────────────▶│
│  • verifica HMAC X-Hub-Sig    │               └── fallback humano
│  • parse mensagem             │
│  • carrega WaConversation     │       ┌─────────────────────────────────┐
│  • dispatch handler           │ ────▶ │ Yogo API (proxy interno já existe)
│  • envia resposta WA          │       │  GET /classes, GET /class-signups,
│  • grava WaMessage in/out     │       │  POST /class-signups, DELETE …  │
└───────────────────────────────┘       └─────────────────────────────────┘
        ▲
        │ GET (verify_token handshake)
        │
        │ (separado) Cron diário 11h00 Lisboa
┌───────────────────────────────┐
│ GET /api/cron/trial-followup  │ → Yogo trials ontem → envia template HSM → grava log
└───────────────────────────────┘

Persistência: Turso (Prisma)
  WaConversation  estado actual (intent pendente, classId, TTL)
  WaMessage       histórico in/out (inbox dashboard)
  WaSentTemplate  log de templates enviados (idempotência cron)
```

**Pontos-chave:**

- Webhook responde a Meta em **<500ms** (limite Meta). Trabalho cabe nesse tempo: 1-2 chamadas Yogo + 1 envio WA.
- **Identificação aluno**: número WA E.164 → procura em `/customers?search=<phone>`. Resultado cacheado 24h em `WaConversation.yogoCustomerId`/`yogoCachedAt`.
- **Sem LLM no v1** — regex/keyword matching.
- **Token Yogo manual**. Banner no header do dashboard quando faltam <30 dias (já há infra para). Refresh automático adia para projecto separado.

## Modelo de dados (Prisma + Turso)

```prisma
model WaConversation {
  phone           String   @id                 // E.164: +351912345678
  yogoCustomerId  Int?                          // cached lookup
  yogoCachedAt    DateTime?
  intent          String?                       // null | "awaiting_reserva_class" | "awaiting_reserva_confirm" | "awaiting_cancel_pick" | "awaiting_cancel_confirm"
  pendingClassId  Int?
  pendingSignupId Int?
  expiresAt       DateTime?                     // TTL 5min; depois disto intent vira null no próximo dispatch
  needsHuman      Boolean  @default(false)      // marcado quando fallback dispara
  updatedAt       DateTime @updatedAt
  messages        WaMessage[]
}

model WaMessage {
  id           String   @id @default(cuid())
  phone        String
  direction    String                            // "in" | "out"
  type         String                            // "text" | "interactive_list" | "interactive_button" | "template"
  body         String                            // texto plano ou JSON serializado
  metaId       String?  @unique                  // wa.id da Meta (idempotência inbound)
  errorCode    String?                           // se envio falhou
  createdAt    DateTime @default(now())
  conversation WaConversation @relation(fields: [phone], references: [phone])

  @@index([phone, createdAt])
}

model WaSentTemplate {
  id              String   @id @default(cuid())
  phone           String
  templateName    String
  yogoCustomerId  Int?
  triggerKey      String   @unique               // ex: "trial_followup:2026-05-24:123" — idempotência cron
  sentAt          DateTime @default(now())
  metaMessageId   String?
}
```

Notas:

- `phone` como `@id` simplifica lookups; se aluno mudar de nº é nova conversa (aceitável).
- `intent` como string (não enum) para evitar migrations quando adicionarmos comandos.
- `WaSentTemplate.triggerKey` garante que se o cron correr 2x no mesmo dia, não duplica envios.

## Fluxos detalhados

### Reservar

1. Aluno: `reserva` (ou `reservar`, `marcar`, `agendar`, `aulas?`)
2. Webhook → handler `reservar`
3. Lookup `yogoCustomerId` (cache 24h)
4. `GET Yogo /classes?startDate=hoje&endDate=amanhã&populate[]=signup_count&populate[]=teachers&populate[]=class_type`
5. Filtra aulas a que o aluno tem acesso (membership/passes activos do aluno)
6. Se >10 itens (limite Meta), mostra hoje + linha final `[Ver amanhã]`
7. WA: interactive list message (rows com `id=classId`)
8. `WaConversation`: `intent="awaiting_reserva_confirm"`, expira em 5min
9. `WaMessage`: out, `type=interactive_list`

10. Aluno toca aula → webhook recebe `interactive.list_reply.id = classId`
11. Set `pendingClassId=<classId>`
12. WA: button message "Confirmas? Striking · hoje 19:30 com João" `[Sim, reservar]` `[Cancelar]`

13. Aluno toca `Sim, reservar`
14. `POST /class-signups {user:"<id>", class:<id>, checked_in:false}` (user como **string** — int devolve 500)
15. Sucesso → "Reservado. Aparece 10 min antes."
16. Falha → mensagem humana ("Aula cheia" / "Sem aulas no plano" / etc)
17. Reset `WaConversation` (intent/pendingClassId/pendingSignupId = null)

### Cancelar

1. Aluno: `cancelar`
2. `GET /class-signups?user=<id>&populate[]=class&startDate=hoje`
3. Filtra inscrições futuras (start > now)
4. 0 → "Não tens aulas reservadas."
5. 1+ → list message (id=signupId) → button confirm → `DELETE /class-signups/{id}` → "Cancelado."

### Fallback

Mensagem não bate em nenhum comando E `intent==null`:

- WA: "Diz **reserva** para marcar uma aula ou **cancelar** para desmarcar. Para outras questões o Marcelo responde-te em breve."
- `needsHuman=true`
- `/dashboard/chat` mostra badge "🔴 N precisa humano"

### Cron trial follow-up

Corre todos os dias às 11h00 Lisboa (`0 10 * * *` UTC):

1. `GET /api/cron/trial-followup` (auth: `Authorization: Bearer ${CRON_SECRET}`)
2. Chama Yogo report `trialAttended` com `startDate=ontem endDate=ontem` (mesma query que `dashboard/page.tsx:105`)
3. Para cada aluno:
   - `triggerKey = "trial_followup:<yyyy-mm-dd-ontem>:<customerId>"`
   - Se `WaSentTemplate.triggerKey` já existe → skip
   - Se sem telemóvel → skip + log
   - `POST https://graph.facebook.com/v21.0/<WA_PHONE_NUMBER_ID>/messages` com:
     ```json
     {"messaging_product":"whatsapp","to":"<phone>","type":"template",
      "template":{"name":"trial_followup_pt","language":{"code":"pt_PT"},
                  "components":[{"type":"body","parameters":[{"type":"text","text":"<primeiroNome>"}]}]}}
     ```
   - Grava `WaSentTemplate` + `WaMessage(direction=out, type=template)`

**Erros tratados:**

- 401/403 Meta → throw, alerta no log (token caducou)
- 429 rate limit → backoff exponencial (3 tentativas)
- 400 invalid recipient → skip + grava `errorCode`

### Template `trial_followup_pt` (a submeter à Meta antes do go-live)

```
Categoria: MARKETING
Idioma: pt_PT
Body: "Olá {{1}}! 👊 Que tal a aula de ontem na Striker's House?
Se quiseres voltar, marca a próxima aqui — basta responder 'reserva'.
Temos um plano à tua medida quando quiseres falar."
Footer: "Striker's House · Carcavelos"
```

Aprovação Meta ~24-48h. O código consegue ser entregue antes (cron faz no-op até template estar aprovado).

## Estrutura de ficheiros

```
src/
├── app/
│   ├── api/
│   │   ├── whatsapp/webhook/route.ts   # GET (handshake) + POST (eventos)
│   │   └── cron/trial-followup/route.ts
│   └── dashboard/chat/page.tsx         # inbox: lista WaConversation, mostra mensagens
├── lib/
│   ├── wa/
│   │   ├── meta.ts                     # cliente Meta (sendText, sendList, sendButton, sendTemplate)
│   │   ├── verify.ts                   # HMAC X-Hub-Signature-256
│   │   ├── parser.ts                   # keyword → intent
│   │   ├── lookup.ts                   # phone → yogoCustomerId (com cache 24h)
│   │   └── handlers/
│   │       ├── reservar.ts
│   │       ├── cancelar.ts
│   │       └── fallback.ts
│   └── yogo/
│       └── signups.ts                  # wrappers tipados Yogo
prisma/schema.prisma                    # + WaConversation, WaMessage, WaSentTemplate
vercel.json                             # cron trial-followup
```

## Setup Vercel / Meta

**Vercel:**

1. Marketplace → Turso (1-click) → auto-provisiona `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
2. `npx prisma migrate dev` (cria 3 tabelas)
3. `vercel.json`:
   ```json
   {
     "crons": [{ "path": "/api/cron/trial-followup", "schedule": "0 10 * * *" }]
   }
   ```
4. `vercel env add` para cada: `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_BUSINESS_ACCOUNT_ID`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET`, `CRON_SECRET`

**Meta Developers (manual, ~20min):**

1. App → Configuration → Webhooks → Callback URL: `https://strikehousedashboard.vercel.app/api/whatsapp/webhook`
2. Verify Token: igual a `WA_VERIFY_TOKEN`
3. Subscribe field `messages`
4. WhatsApp Manager → Templates → criar `trial_followup_pt` → submeter

**Credenciais já confirmadas:**

- `WA_PHONE_NUMBER_ID=1148538915006619`
- `WA_BUSINESS_ACCOUNT_ID=1699574434508093`
- `WA_ACCESS_TOKEN` em mãos (validar se é System User token — long-lived — ou user token de 24h; se for o segundo, gerar System User token antes do go-live)
- `WA_APP_SECRET` a copiar de Meta Developers → App → Settings → Basic

## Auth & segurança

- Webhook endpoint **público** — autenticação via HMAC do header `X-Hub-Signature-256` contra `WA_APP_SECRET`. Pedido sem assinatura válida → 401, não grava nada.
- Cron endpoint protegido por `Authorization: Bearer ${CRON_SECRET}` (Vercel injecta automaticamente quando definido).
- `/dashboard/chat` herda middleware existente — **só `admin`** (Ricardo + Marcelo). Conversas têm PII; equipa `sales` não vê.
- `WA_ACCESS_TOKEN` e secrets nunca em código/git — só `.env.local` + Vercel env.

## Custos estimados

| Item | Custo |
|---|---|
| Mensagens inbound (pull) | €0 (Meta gratis) |
| Mensagens outbound dentro de 24h | €0 |
| Template `trial_followup_pt` (marketing) | ~€0.05-0.10 por envio |
| Cron 1x/dia × ~5-10 trials/dia | **<€20/mês** |
| Turso | free tier suficiente |
| Vercel Cron | incluído no plano actual |

## Riscos / mitigações

- **Webhook >500ms** → Meta retenta. Se Yogo lento, mover envio WA para background com `waitUntil()`. Por agora síncrono (Yogo costuma responder <300ms).
- **Token Meta caduca** (se for user token 24h) → cron e webhook começam a falhar com 401. Mitigação: validar antes do go-live que é System User token long-lived.
- **Aprovação template demora** → cron faz no-op (skip + log) até `trial_followup_pt` aprovado. Não bloqueia restantes funcionalidades.
- **Aluno responde ao template e abre janela 24h** → próximas respostas grátis até 24h depois. Espera-se que isto seja desejável (conversão).
- **Aluno bloqueado/sem WA** → 400/403 da Meta. Skip + log + `errorCode` em `WaMessage`. Sem retry.

## Open questions / a confirmar antes de implementar

- [ ] `WA_ACCESS_TOKEN` é System User token? (Confirmar com Ricardo antes de mexer em código de produção.)
- [ ] Copy exacto do template "trial_followup_pt" — versão acima é proposta. Marcelo/Ricardo aprovam antes de submeter à Meta.
- [ ] Horário do cron — 11h00 Lisboa proposto. Ajustar se preferirem outra hora.

## Related

- [[WhatsApp-Bot-Design]] — design original (Sprint 4 completo) — este v1 é subset
- [[Roadmap]] — Sprint 4 substituído por este spec; Sprints 1 e 3 adiados
- [[Yogo-API]] — endpoints `/classes`, `/class-signups`
