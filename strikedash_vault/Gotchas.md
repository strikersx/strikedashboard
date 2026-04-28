---
title: Gotchas & Known Issues
type: reference
---

# Gotchas & Known Issues

## 1. Yogo Token Expiry

**Problema:** JWT token do Yogo expira ~6 meses. Token actual expira **Outubro 2026**.

**Impacto:** Dashboard para de funcionar quando token expira.

**Solucao:** Sprint 3 implementa auto-refresh com scheduler e retry/backoff.

**Workaround actual:** Renovar manualmente e atualizar `.env.local`.

## 2. Vercel + SQLite

**Problema:** Filesystem e read-only em Vercel serverless. SQLite funciona para leitura mas nao para escrita.

**Impacto MVP:** Nenhum — MVP so faz proxy, nao escreve no DB.

**Impacto Sprint 1+:** Auditoria WA, leads, etc. precisam de escrita.

**Solucao:** Migrar para **Turso** (SQLite remoto). Drop-in replacement — so muda connection string no Prisma.

## 3. USC Leads Falsos

**Problema:** Emails `usc-*@urbansportsclub.com` sao criados automaticamente pelo Urban Sports Club. Nao sao leads reais.

**Impacto:** Inflam a contagem de leads se nao filtrados.

**Solucao:** `isNonActionableLead()` filtra sempre. Tambem filtra `@strikershouse.*`, `@striker.pt`, `@strikerhouse.com`.

**Regra:** SEMPRE filtrar em qualquer pagina que mostre leads.

## 4. Plan Name Regex

**Problema:** Classificacao de planos usa regex match no `membership_description` que vem do Yogo. Se Yogo mudar nomes dos planos, regex pode falhar.

**Impacto:** Plano classificado como "Outros" incorrectamente.

**Solucao:** Regex e resiliente (case-insensitive, partial match), mas monitorar quando Yogo muda nomes.

**Funcao:** `getPlan(desc)` em `utils.ts`.

## 5. Date Range Queries

**Problema:** `getDashboardRange()` estende ate fim do mes ou +7 dias (o que for maior). Pode incluir aulas futuras no calendario.

**Impacto:** Dados de classes podem mostrar aulas ainda nao realizadas.

**Solucao:** E intencional — permite ver aulas agendadas. Mas labels devem ser claros.

## 6. No Offline Mode

**Problema:** Dashboard requer conexao ao Yogo API. Sem sync, sem fallback local.

**Impacto:** Sem internet = dashboard inutil.

**Solucao:** Nao planeada. Para 3 users em academia com internet, e aceitavel.

## 7. Single Language

**Problema:** UI toda em Portugues de Portugal, hard-coded. Sem i18n.

**Impacto:** Nao e internacionalizavel sem refactor.

**Solucao:** Para 3 users portugueses, e aceitavel. Se necessario, adicionar i18n no futuro.

## 8. GraphQL Revenue Query

**Problema:** A query GraphQL `revenueReport` devolve dados agrupados por mes. A agregacao de items por tipo e feita no client.

**Impacto:** Se houver muitos items, processamento no browser pode ser lento.

**Solucao:** Para o volume actual (~200 transaccoes/mes), nao e problema.

## Related

- [[Yogo-API]] — token e endpoints
- [[Arquitectura]] — Vercel + SQLite
- [[Business-Constants]] — plan regex e USC filtering
- [[Roadmap]] — sprints que resolvem gotchas
