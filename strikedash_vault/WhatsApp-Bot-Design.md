---
title: WhatsApp Bot — Reservation & Class Management
type: design
date: 2026-05-17
---

# WhatsApp Bot Design

Pull-based conversational bot in Striker's House WhatsApp number. Aluno digita comandos -> bot responde com aulas, permite reservar/cancelar.

## Core flow

```
Aluno: "reserva"

Bot:   List message
       HOJE -- sabado 17 mai
         - Boxing 09:00 . Joao  (3 vagas)
         - Girl Power 18:00     (5 vagas)
         - Striking 19:30 . Joao (2 vagas)
       AMANHA -- domingo 18 mai
         - BJJ 10:30 . Ricardo  (4 vagas)
         - Open Mat 11:30       (livre)
                                       [Selecionar aula]

Aluno toca "Striking 19:30"

Bot:   Confirmas?
       Striking . hoje 19:30 com Joao
       [Sim, reservar]  [Cancelar]

Aluno: [Sim, reservar]
       -> POST /class-signups

Bot:   Reservado.
       Striking . hoje 19:30
       Aparece 10 min antes.
       Para cancelar responde "cancelar".
```

## Decisions (2026-05-17)

- **Periodo:** mostra hoje + amanha numa lista unica
- **Confirmacao:** sempre, antes de chamar Yogo
- **Cancelar:** comando "cancelar" -> lista as inscricoes activas -> aluno escolhe -> confirma

## Comandos

| Trigger (regex/keywords) | Accao |
|---|---|
| `reserva\|reservar\|marcar\|agendar\|aulas?` | Inicia fluxo de reserva |
| `cancelar` | Lista inscricoes activas para cancelar |
| `minhas\|meu\|aulas minhas` | Lista proximas inscricoes do aluno |
| `plano\|meu plano` | Sessoes restantes, proximo pagamento |
| Default | Fallback: "Diz **reserva** para marcar uma aula" -- depois encaminhar para humano |

## Yogo API endpoints (spike confirmado 2026-05-17)

| Accao | Metodo + path | Payload | Resposta |
|---|---|---|---|
| Listar aulas | `GET /classes?startDate=...&endDate=...&populate[]=signup_count&populate[]=teachers&populate[]=class_type` | -- | Wrapped `{classes:[...]}` |
| Listar inscricoes user | `GET /class-signups?user={id}&populate[]=class&startDate=...` | -- | Array com classe nested |
| Inscrever | `POST /class-signups` | `{user:"<id>",class:<id>,checked_in:false}` | Signup criado, Yogo escolhe pass/membership automatico |
| Cancelar | `DELETE /class-signups/{signupId}` | -- | `"OK"` |

Detalhes: `user` deve ir como **string** no POST (int devolve 500). Yogo atribui `used_class_pass` ou `used_membership` automaticamente -- nao precisa de logica do nosso lado.

Para Personal Trainer (1-on-1), o endpoint e diferente: `GET/POST /appointments` com schema separado (`appointment_type_id`, `customer_id`, `teacher_id`). Sera tratado em fase 2 do bot.

## Custos Meta

Pull-based = mensagens recebidas gratis + respostas dentro da janela 24h tambem gratis. Custo total esperado: **~EUR 0/mes** em mensageria. Pushes opcionais (lembrete 30min antes, reactivacao de churn) custam ~EUR 0.05-0.15 por conversa iniciada -- estimativa **<EUR 20/mes** mesmo com 150 alunos.

## Limitacao Meta -- list messages

Maximo **10 items por list message**. Striker's House tem ~5-8 aulas/dia, logo 10-16 entre hoje+amanha. Estrategias para resolver (em prioridade):

1. **Filtrar pelo plano do aluno** -- so aulas a que tem acesso. Reduz ~40%.
2. **Esconder aulas cheias** sem lista de espera. Ou mover para o fim.
3. **Fallback split:** se ainda assim >10, mostra hoje completo + item final "[Ver amanha]" que abre nova lista.

## Stack tecnica

```
/api/whatsapp/webhook         POST  recebe eventos Meta
  |-- parser de comandos (keywords + LLM Haiku fallback opcional)
  |-- state machine por nº telefone (em DB)
  +-- accoes -> Yogo proxy

Prisma:
  WaConversation { phone, lastIntent, pendingClassId, expiresAt, ... }
  WaMessage      { phone, direction, type, content, metaId, ... }

Cron jobs (opcional, fase 2):
  Lembrete 30min antes da aula inscrita -> template Meta utility
  Reactivacao churn (sem inscricao ha 14d) -> template Meta marketing
```

State machine e necessaria porque a conversa tem passos: aluno escolhe aula -> bot espera confirmacao. Sem estado, "[Sim, reservar]" nao sabe a que aula se refere.

## Pre-requisitos

- [[Roadmap]] Sprint 1 -- Auditoria WA (cria base de contactos e migra para Turso)
- [[Roadmap]] Sprint 2 -- Funil de Leads (state machine de leads partilha logica)
- [[Roadmap]] Sprint 3 -- Token Yogo auto-refresh (webhook continuo precisa de token sempre valido)
- Conta Meta Business + aprovacao WhatsApp Business API (~1-2 semanas)
- Cloudflare Tunnel para webhook publico (dev)

## Related

- [[Roadmap]] -- Sprint 4 redesenhado com esta abordagem
- [[Yogo-API]] -- referencia geral da API Yogo
- [[Gotchas]] -- limitacoes plataforma
