---
title: WhatsApp Bot v1 — Session Handoff
date: 2026-05-25
status: slice-0-ready-for-merge
next-action: review-and-merge-PR-1
---

# WhatsApp Bot v1 — Handoff

Sessão a 2026-05-25 implementou Slice 0 do WhatsApp bot v1 da Striker's House. Próxima sessão continua daqui.

## TL;DR — onde estás

- **Spec final**: `docs/superpowers/specs/2026-05-25-whatsapp-bot-v1-design.md` (post-adversarial review, ready-for-implementation)
- **Adversarial trace**: `reason/260525-0025-wa-bot-v1-plan-review/`
- **PR #1 aberto**: https://github.com/strikersx/strikedashboard/pull/1 — Slice 0 (vitest + `src/lib/phone.ts`), 37/37 tests, code-review clean
- **Branch**: `wa-bot/slice-0-test-infra` (2 commits, pushed)
- **Workflow seguido**: `development-workflow` (vault → karpathy → brainstorm → autoresearch:reason → SMDV → search-before-create → execute → tests → self-review → code-review)

## Próxima acção (in order)

1. **Review do PR #1 e merge** — Must-fix/Should-fix buckets vazios; pre-existing build/lint não são introduzidos por este PR.
2. **Step 6 service-layer-refactor** — para Slice 0 é apenas: confirmar que `phone.ts` está bem isolado (verificado), update do vault/spec se necessário, fechar PR.
3. **G2 spike (phone normalisation)** — bloqueia Slice 3.  Correr `phone.ts` contra os ~700 customers do Yogo dump → assert ≥98% map para single E.164. **Sem este número documentado, Slice 3 não arranca.** Script sugerido: `scripts/phone-spike.ts` (a criar).
4. **G1 — confirmar System User token Meta** — curl `https://graph.facebook.com/v21.0/me -H "Authorization: Bearer $WA_TOKEN"` 25h depois do issue. Confirma que não é user token de 24h.
5. **G3 — submeter template `trial_followup_pt`** no WhatsApp Manager. Lead aprovação 24-48h.
6. **Slice 1** — Turso via Vercel Marketplace + `yogoFetch` extraction. ~80 LOC, zero features. Build smoke obrigatório (todas as `/dashboard/*` pages).
7. **Slice 2** — Webhook skeleton + audit (5 Prisma models). ~250 LOC. Echo handler.
8. **Slice 3** — Reservar flow (bloqueado por G2). ~350 LOC.
9. **Slice 4** — Cancelar flow. ~200 LOC.
10. **Slice 5** — Trial follow-up cron (G3 deve estar submetido). ~150 LOC.
11. **Slice 6** — Kill switch + health endpoint. ~80 LOC.

## Acceptance criteria (locked)

| Field | Value |
|---|---|
| Scope | 3 fluxos pull (reserva, cancelar, fallback) + 1 cron diário trial follow-up. Turso. Kill switch `WA_ENABLED`. GDPR 90d purge. SEM `/dashboard/chat` em v1. SEM PT signups (fase 2). |
| Metric | (a) ≥10 reservas + ≥5 cancels com ≥5 alunos distintos em 1 semana, <2% erro Yogo. (b) Cron entrega ≥75% dos trials de ontem. |
| Direction | Maximizar bookings/cancels OK. Minimizar `LOOKUP_MISS`, `HMAC_FAIL`, `SESSION_RACE`, `BOOKING_FAIL`. |
| Verify | Queries SQL contra Turso (≤5min). Runbook documenta. `/api/whatsapp/health` mostra contagens 24h. |

## Credenciais Meta (a configurar em `.env.local` + `vercel env`)

```
WA_PHONE_NUMBER_ID=1148538915006619
WA_BUSINESS_ACCOUNT_ID=1699574434508093
WA_ACCESS_TOKEN=<System User token — confirmar não é user token 24h via G1>
WA_APP_SECRET=<copiar de Meta Developers → App → Settings → Basic>
WA_VERIFY_TOKEN=<gerar random secret>
WA_TEMPLATE_TRIAL_FOLLOWUP=trial_followup_pt
WA_ENABLED=true
CRON_SECRET=<gerar random>
DATABASE_PROVIDER=libsql
DATABASE_URL=<de Turso Marketplace>
DATABASE_AUTH_TOKEN=<de Turso Marketplace>
```

**Secrets NUNCA em código nem commits.** Token bruto que recebi nesta sessão começa com `EAAic5AyXmZ...` — guardar em local seguro fora do repo.

## Decisões já travadas (não revisitar sem motivo)

- **Persistência**: Turso (libsql) via Vercel Marketplace. Adapter `@prisma/adapter-libsql`. Prisma 7 + driverAdapters preview feature.
- **Comandos v1**: `reserva` + `cancelar` + `fallback`. `minhas`/`plano` ficam para v1.1.
- **Cron follow-up**: automático, 11h Lisboa. Dual schedule `0 10 * * *` + `0 11 * * *` em UTC com `Europe/Lisbon` early-exit unless hour==11 (resolve DST).
- **Kill switch**: env var `WA_ENABLED=false` ack-only. Sem botão no dashboard.
- **GDPR retention**: 90 dias purga via cron (`/api/cron/wa-purge` 03h00 daily DELETE WHERE receivedAt < now-90d).
- **Inbox `/dashboard/chat`**: NÃO em v1.
- **Cache `yogoCustomerId`**: coluna reservada em `WaContact` para v1.1 backfill, NÃO populada em v1.
- **Token Yogo**: continua manual até Out/2026. Sprint 3 dedicado depois. Banner aviso quando <30 dias é fora deste âmbito.
- **Tests**: vitest 4.1.5 + `@vitest/coverage-v8` 4.1.5 (ambos ≥14d, Invariant #9 OK).
- **`/dashboard/chat` inbox visivel só admin** (não sales) — quando vier em v1.1.

## Constraints duros (não relaxar)

- **Invariant #9**: nenhum pacote npm/pip <14 dias. Verificar com `npm view <pkg> time.modified` antes de instalar.
- **Webhook ack <50ms**: Meta retenta agressivo em >timeout. `metaId @unique` write BEFORE side effects, processing em `waitUntil`.
- **Cancelar mandatório N=1 confirm + start_time > now+15min**: mid-class taps perdem slot pago.
- **PT phone normalization**: regra congelada após G2. Sem mudanças mid-implementation.
- **HMAC raw body**: `req.text()` once em `raw-body.ts`. JSON.parse da mesma string. Next 16 App Router consome stream em `req.json()`.

## Pre-existing problemas (NÃO introduzidos por esta PR)

- **`npm run build` partido em Node 25 local** — React 19 + Next 16 + Node 25 prerender bug no `/_global-error`. Vercel deploys com Node 24 LTS devem passar. Adicionei `.nvmrc=24` para alinhar. **Verificar Vercel preview do PR #1.**
- **`npm run lint` partido** — ESLint 9 + `eslint-config-next` 16 circular structure. Upstream issue. Não fixar mid-Slice; deserve own PR.
- **8 vulnerabilities npm audit** — todas em deps pré-existentes (prisma, hono, next). Pré-existente; fix independente.

## Slice 0 — o que está em PR #1

**Files:**
- `vitest.config.ts` — cobertura `src/lib/**`, exclui ficheiros pre-existentes sem testes
- `src/lib/phone.ts` — `normalize(input) → { e164, variants[] }`
  - PT 12-digit (`351*`) accepted with hasPlus/00 prefix OR bare-12
  - Bare 9-digit assumed PT mobile/landline
  - Foreign accepted as E.164 with ≥8 digits
  - Invalid: embedded `+`, non-string, `<MIN_INTL_DIGITS=8` international, length>15, etc.
- `tests/lib/phone.test.ts` — 37 table-driven cases
- `package.json` scripts: `test`, `test:watch`, `test:coverage`, `typecheck`
- `.nvmrc=24`
- `.gitignore` += `coverage`

**Already-fixed bugs (code-review medium):**
1. Embedded `+` (`"++351912345678"` produced malformed e164)
2. Non-string crash (`normalize(912345678)` threw TypeError)
3. PT_COUNTRY length unbounded (`"3515551234"` accepted as PT)
4. Order dep — `"351999999"` misclassified (resolved by #3)
5. `"00"` over-eager (`"001234567"` → `"+1234567"`)
6. `MIN_DIGITS=7` too low (`"+1234567"` accepted)

**Open follow-ups (LOW/INFO):**
- Full-width digits silently dropped (Arabic/Japanese keyboards)
- `vitest test.include` doesn't catch co-located `src/**/*.test.ts`
- `coverage.exclude` uses literal paths instead of globs
- `coverage.include` scoped to `src/lib/**` only — won't cover `src/app/api/whatsapp/*` routes in later slices
- `@` alias in vitest config is unused (tests use relative imports)

## Como continuar (recipe para próxima sessão)

```
# 1. Confirmar contexto
cat docs/superpowers/handoffs/2026-05-25-wa-bot-handoff.md
git status
git log --oneline -5

# 2. Verificar PR #1 status
gh pr view 1 --repo strikersx/strikedashboard
# Se merged: ler próximo passo abaixo
# Se aberto: ler review, fazer ajustes se houver feedback, merge

# 3. Post-merge: Step 6 (service-layer-refactor) — para Slice 0 mínimo
#    - Confirmar phone.ts não é chamado de controllers/routes ainda (correcto)
#    - Update vault se necessário (já feito)
#    - Cleanup branch local: git branch -d wa-bot/slice-0-test-infra

# 4. Arrancar G2 spike
mkdir -p scripts
# Criar scripts/phone-spike.ts:
#   - GET /api/yogo/reports/customers (todos os ~700)
#   - Para cada customer.phone, correr normalize()
#   - Métricas: count e164 não-null, count duplicates, count nulls
#   - Output: relatório com % de hit rate (precisa ≥98%)
# Correr e documentar resultado em reason/.../g2-phone-spike.md

# 5. Confirmar G1 + G3
#    G1: curl /me 25h depois do token issue
#    G3: submeter template trial_followup_pt no WhatsApp Manager

# 6. Quando G2 ≥98% E G1 confirmado E G3 submetido:
#    git checkout main && git pull
#    git checkout -b wa-bot/slice-1-turso-yogofetch
#    [implementar per spec Slice 1]

# 7. Se workflow autoresearch:reason ainda aplica:
#    Não correr de novo para slice 1 — o plano global já passou.
#    Cada slice tem o seu próprio code-review --effort high (Slice 1 toca em
#    config DB que é boundary crítico).
```

## Pessoas / contactos

- **Ricardo**: founder/dev — admin do dashboard, autor do spec
- **Marcelo**: ops — quem vai consumir o bot na recepção; daily runbook queries
- **Sales team**: NÃO tem acesso ao WA admin endpoint em v1

## Files dos quais a próxima sessão precisa de saber

| Caminho | Por quê |
|---|---|
| `docs/superpowers/specs/2026-05-25-whatsapp-bot-v1-design.md` | Spec autoritativo |
| `reason/260525-0025-wa-bot-v1-plan-review/` | Adversarial trace |
| `reason/260525-0025-wa-bot-v1-plan-review/code-review-slice-0.md` | Findings detalhados |
| `strikedash_vault/WhatsApp-Bot-v1-Spec.md` | Pointer canónico vault |
| `strikedash_vault/Roadmap.md` | Sprint 4 substituído por este âmbito |
| `strikedash_vault/Gotchas.md` | #1 token, #2 SQLite+Vercel, #3 USC filter |
| `strikedash_vault/Yogo-API.md` | Endpoints reuse |
| `CLAUDE.md` | Regras de projecto (linguagem PT-PT, dark theme, etc) |
| `src/lib/phone.ts` | Normaliser pronto, consumido por `findCustomerByPhone` (não existe ainda — vem na Slice 3) |

## Glossário rápido

- **G1/G2/G3**: pre-slice gates (token confirm, phone spike, template submit)
- **SMDV**: Scope/Metric/Direction/Verify acceptance criteria
- **WaInbound/Outbound/Session/Contact/Event**: 5 Prisma models para Turso
- **MetaId**: o `wa.id` da Meta (dedup retries)
- **LOOKUP_MISS**: aluno escreveu mas não bate com nenhum customer Yogo → fallback humano
- **TEMPLATE_PENDING**: cron quer mandar mas template ainda não foi aprovado Meta → no-op + log
- **Yogo client param**: `user` no POST `/class-signups` tem de ir como **string** (int devolve 500)

---

**Última actualização**: 2026-05-25 ~13h00 GMT+1.
