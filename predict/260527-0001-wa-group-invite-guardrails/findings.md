# Findings — WA Group Invite Guard Rails

Commit: `e4322bac` · Personas: 5 · Rounds: 2 · Anti-herd: PASSED

Ranked by composite priority score (`severity * 0.4 + confidence * 0.2 + consensus * 0.4`).

---

## Finding 1: Preview/non-prod deployments share the same Turso DB, Yogo token, and WhatsApp credentials as production

**Severity:** CRITICAL · **Confidence:** HIGH · **Location:** Vercel env config (cross-deployment) · **Consensus:** 5/5 confirm

**Evidence:** Every Vercel Preview build inherits prod `DATABASE_URL`, `YOGO_TOKEN`, `WA_ACCESS_TOKEN`, `WA_GROUP_INVITE_URL`. Anyone landing on a preview URL with admin auth can trigger Convidar Todos and hit real recipients.

**Recommendation:**
- Add to bulk endpoint: `if (process.env.VERCEL_ENV !== "production") return 423 { error: "outbound_disabled_non_prod" }`.
- Also gate on a code-side constant: `INVITE_URL_FINGERPRINT_PROD` (last 6 chars of the prod link, kept in `lib/wa/config.ts`). At endpoint entry, require `WA_GROUP_INVITE_URL.endsWith(FINGERPRINT_PROD)` → catches both prod-env mismatch and accidental env rotation.

---

## Finding 2: Bulk endpoint trusts client-supplied recipient list

**Severity:** CRITICAL · **Confidence:** HIGH · **Location:** spec §Algorithm + planned route · **Consensus:** 5/5 confirm

**Evidence:** Per spec, request body is `{ phoneE164s: string[], force, dryRun }`. A coding bug, a malicious admin, or a curl invocation can pass any list of phones and the server sends to them.

**Recommendation:** Drop `phoneE164s` from the request. Endpoint takes only `{ force, dryRun }`. Internally it calls `computeCoverage()` and uses `report.missingFromGroup` as the recipient list. The UI shows the same list before confirmation. Single source of truth, server-side.

---

## Finding 3: No global outbound kill switch; `WA_ENABLED` only affects inbound webhook

**Severity:** CRITICAL · **Confidence:** HIGH · **Location:** `src/lib/wa/config.ts:4-6` · **Consensus:** 5/5 confirm

**Evidence:** `isWaEnabled()` is called only in `src/app/api/whatsapp/webhook/route.ts:49`. Flipping `WA_ENABLED=false` mutes inbound but bulk send (and any future outbound) fires regardless.

**Recommendation:**
- Add `isOutboundEnabled()` in `config.ts`: returns `process.env.WA_OUTBOUND_ENABLED === "true"`. Default `false` → must be explicitly opt-in per environment.
- Bulk endpoint, future cron, and any non-reply outbound check this gate first.
- In Vercel: set `WA_OUTBOUND_ENABLED=true` only in Production. Preview/dev get the default false.

---

## Finding 4: Roster import is full-replace; a bad paste nukes the entire WhatsApp group roster

**Severity:** CRITICAL · **Confidence:** HIGH · **Location:** `src/app/api/whatsapp/admin/group-members/import/route.ts:46-50` · **Consensus:** 5/5 confirm

**Evidence:** `db.waGroupMember.deleteMany({ where: { phoneE164: { notIn: keep } } })` — if `keep` is small (operator pastes 5 lines by accident), 109 of 114 rows are deleted. Next Resync → 80 active subs − 5 in group = 75 "faltam convidar" → Convidar Todos spams 75 people, including 70 already in the group.

**Recommendation (defence in depth):**
1. Soft-delete: add `archivedAt DateTime?` to `WaGroupMember`; "delete" sets the column instead of removing rows. `findMany` filters `archivedAt: null`. Manual restore button per row.
2. Threshold guard: if upload count < 50% of current roster, require explicit `confirmReplace: true` flag. UI surfaces the diff before confirming.

---

## Finding 5: No invite-URL integrity guard (regex + fingerprint + provenance)

**Severity:** CRITICAL · **Confidence:** HIGH · **Location:** spec §"Environment variable" · **Consensus:** 5/5 confirm (merged from OP-2 + SEC-1 + DA-1)

**Evidence:** `WA_GROUP_INVITE_URL` is read raw and concatenated into the template parameter. No validation that it's a real `chat.whatsapp.com/...` URL. No fingerprint stored to detect changes. No health check that the link still works.

**Recommendation (three-layer guard):**
1. **Regex validation** at endpoint entry: `/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{15,30}$/`. Reject with `BAD_INVITE_URL_REJECTED` WaEvent.
2. **Code-side fingerprint** (Finding 1): `INVITE_URL_FINGERPRINT_PROD = "AbCdEf"` (last 6 chars) — only changes via PR.
3. **Operator confirmation** in UI: dashboard displays last 6 chars; operator clicks "✓ Confirmo `AbCdEf`" once per session before bulk unlocks.
4. **Daily health check** (cron): `fetch(WA_GROUP_INVITE_URL, { method: "HEAD" })` and log `INVITE_URL_OK` / `INVITE_URL_DEAD`. Endpoint refuses to send if last check < 24h ago is DEAD.

---

## Finding 6: No batch-level lock; concurrent or double-clicked bulks can double-send

**Severity:** HIGH · **Confidence:** MEDIUM (race is plausible but not common) · **Location:** spec §"Algorithm" · **Consensus:** 4/5 confirm (Devil's Advocate reframed but accepted)

**Evidence:** 30-day idempotency check happens per-row before each send. Two concurrent batches (or a UI double-click) → both read empty WaOutbound → both send.

**Recommendation:** Add `WaBatch { id PK, kind, startedAt, finishedAt, status }` table. Bulk endpoint does `db.waBatch.create({ data: { id: "invite_" + Date.now() } })` and `db.waBatch.findFirst({ where: { kind: "invite", finishedAt: null } })` — refuse if a non-finished batch exists. On crash, batch row stays open; cleanup via a 1-hour stale-batch GC.

---

## Finding 7: No total-send cap; a buggy caller can fire to arbitrary list size

**Severity:** HIGH · **Confidence:** HIGH · **Location:** spec §"Request body" · **Consensus:** 5/5 confirm

**Evidence:** Combined with Finding 2, the endpoint accepts any-length `phoneE164s`. Even with Finding 2 fixed (server-derived list), a bug in `computeCoverage` could return a wildly wrong list size (e.g. 500 if Yogo returns all customers as missing due to a phone-format change).

**Recommendation:** Hard cap: `if (recipients.length > Number(process.env.WA_BULK_MAX || 100)) return 400 { error: "exceeds_cap" }`. Sanity check: refuse if `recipients.length > activeSubs.length` (impossible by definition).

---

## Finding 8: Migration runner has no idempotency lint and no pre-apply schema dump

**Severity:** HIGH · **Confidence:** HIGH · **Location:** `scripts/migrate-turso.mjs:42-77` · **Consensus:** 4/5 confirm (DA softened from "transactions" to "idempotent SQL")

**Evidence:** Multi-statement migration with no transaction. If stmt 3/5 fails, stmts 1-2 are committed but `_prisma_migrations` row is not written → next run retries 1-2 (which fail "table exists") and never reaches 4-5. Also: no backup before destructive DDL.

**Recommendation (two changes):**
1. Pre-apply linter: scan each statement; if any `CREATE TABLE` lacks `IF NOT EXISTS`, or `ALTER TABLE` lacks idempotency guards, refuse to apply. (Prisma's default `CREATE TABLE` is not idempotent — need to either patch the migration file or auto-rewrite.)
2. Pre-apply dump: `node scripts/turso-dump.mjs > backups/{timestamp}-{commit}.sql` before any APPLY. Refuse migrate if dump fails.

---

## Finding 9: Template send has no preflight approval check

**Severity:** HIGH · **Confidence:** MEDIUM · **Location:** `src/lib/wa/meta.ts:56-70` + spec rollout · **Consensus:** 4/5 confirm

**Evidence:** Spec says "wait for Meta approval" as a manual step but nothing in code enforces it. Operator can click Convidar Todos with the template still in PENDING — all 32 sends will fail with Meta 132xxx, generating noise and potentially hurting the WABA quality score.

**Recommendation:** Bulk endpoint preflight: `GET https://graph.facebook.com/v21.0/{WABA_ID}/message_templates?name=convite_grupo_whatsapp&language=pt_PT`. If status !== "APPROVED", return 503 `{ error: "template_not_approved", currentStatus }`. Cache result for 15min to avoid hitting Meta on every click.

---

## Finding 10: Confirmation modal is a single click + checkbox; high accidental-trigger risk

**Severity:** HIGH · **Confidence:** HIGH · **Location:** spec §"UI changes" · **Consensus:** 5/5 confirm (sharpened in debate)

**Evidence:** Spec defines a confirmation prompt with checkbox. UX precedent: this is roughly as protective as "are you sure" alerts that people muscle-memory click through. With CRITICAL blast radius (32 messages), one accidental Enter = 32 sends.

**Recommendation:**
- Button label shows the count: `Convidar 32 pessoas` (not generic "todos").
- Confirmation modal requires typing the count digit-for-digit (`Type 32 to confirm`).
- Show first 5 recipient names + "and 27 more" inline.
- Disable button if any of: roster age > 7d, no fingerprint confirmation today, last health check DEAD.

---

## Finding 11: No out-of-band notification when bulk send fires

**Severity:** HIGH · **Confidence:** HIGH · **Location:** (new) · **Consensus:** 4/5 confirm (replaces SEC-3 MFA per debate)

**Evidence:** If Marcelo triggers bulk send, Ricardo only knows by checking `/dashboard/wa` events. No alert. If a compromised cookie / mistake fires bulk, hours pass before anyone notices.

**Recommendation:** Outbound notification on every bulk-trigger event:
- Simplest: send a `sendText` to Ricardo's phone (already a number the bot knows): `"Convidar Todos disparado por sessão admin às 14:32. 32 destinatários planeados. Dry-run: false."` via the bot itself.
- Alternative: Slack webhook (if Ricardo has one).
- Fires before the batch starts so Ricardo can flip `WA_OUTBOUND_ENABLED=false` to abort mid-batch.

---

## Finding 12: Roster freshness has no enforcement; stale data drives mis-targeting

**Severity:** HIGH · **Confidence:** HIGH · **Location:** `WaGroupMember.importedAt` + UI · **Consensus:** 4/5 confirm

**Evidence:** WaGroupMember has `importedAt`. UI doesn't surface it. Someone could import roster in May, never update, and re-trigger Convidar Todos in August against people who joined/left in between.

**Recommendation:**
- Coverage page shows roster age prominently: `Roster importado há 3 dias`.
- Bulk endpoint refuses if `max(importedAt) < NOW() - 7 days`. UI shows alert: "Re-importar antes de enviar."
- Warning banner at 24h+.

---

## Finding 13: Sequential 200ms-gap loop has no checkpoint; partial failures invisible

**Severity:** MEDIUM · **Confidence:** HIGH · **Location:** spec §Algorithm · **Consensus:** 4/5 confirm

**Evidence:** If function crashes at iteration 15/32, no way to resume from 16. Re-running gets caught by 30-day idempotency for 1-14, but operator can't see "where did it stop?"

**Recommendation:** Use the `WaBatch` table from Finding 6. Each iteration writes `WaBatchItem { batchId, phoneE164, outcome }`. UI shows progress: `15/32 processados · 12 enviados · 2 saltados · 1 falhou`. Resume button picks up incomplete items.

---

## Finding 14: Per-batch quality-rating risk; tight loop can degrade WABA reputation

**Severity:** MEDIUM · **Confidence:** MEDIUM · **Location:** spec §"Algorithm" — 200ms gap · **Consensus:** 3/5 confirm (DA + Bulk-Ops + Reliability)

**Evidence:** Meta tracks per-number quality rating. A cluster of 32 cold sends within 6 seconds spikes the "marketing burst" pattern; if multiple recipients ignore/report, quality drops.

**Recommendation:** Increase inter-send gap to 5 minutes (or randomize 3-7 min). 32 sends complete in ~2.5h. Adds resilience: if quality signals deteriorate mid-batch, operator can pause.

---

## Finding 15: Bulk button position invites misclicks

**Severity:** MEDIUM · **Confidence:** MEDIUM · **Location:** spec §"UI changes" · **Consensus:** 3/5 confirm

**Evidence:** Bulk button is in the same section header as the sub list. Fast triage scrolling could trigger.

**Recommendation:** Pin the bulk action to a separate styled card above the list, with extra margin and a distinct background colour. Mobile: separate sticky bar.

---

## Finding 16: Admin auth is single-factor; cookie compromise = full bulk capability

**Severity:** MEDIUM · **Confidence:** HIGH · **Location:** `src/lib/auth.ts:7-11` · **Consensus:** 3/5 confirm (DA + Operator + Security)

**Evidence:** `password === process.env.ADMIN_PWD` is the only barrier. Marcelo and Ricardo share. No MFA, no IP allow-list, no rate-limit.

**Recommendation (paired with Finding 11):**
- Out-of-band notification to Ricardo on every bulk-trigger (Finding 11) is the primary mitigation.
- Optionally: rate-limit `/api/whatsapp/admin/group-invite/bulk` to 1 call per admin session per hour at the middleware layer.

---

## Finding 17: Migration timestamp ordering relies on lexicographic sort

**Severity:** MEDIUM · **Confidence:** HIGH · **Location:** `scripts/migrate-turso.mjs:36-38` · **Consensus:** 3/5 confirm

**Evidence:** `readdirSync(...).sort()` works for `YYYYMMDDHHMMSS_*` today but a future migration named `2099_*` (no timestamp) would sort wrong.

**Recommendation:** Validate prefix regex `^\d{14}_` at script start; refuse to run if any migration dir name doesn't match.

---

## Finding 18: WaOutbound.payload stores full template parameters incl. PII

**Severity:** LOW · **Confidence:** HIGH · **Location:** schema.prisma + spec · **Consensus:** 3/5 confirm

**Evidence:** PII at rest, redundant with `phoneE164`.

**Recommendation:** Store only `{ templateName, language, parameterCount }`, not parameter values.

---

## Finding 19 (minority): MARKETING template costs ~3-4× UTILITY in Portugal

**Severity:** LOW · **Confidence:** MEDIUM · **Location:** spec §"Meta template" · **Consensus:** 2/5 confirm (Devil's Advocate)

**Evidence:** Meta categorization affects per-message cost. For 32 sends/month negligible; scales if cohort grows.

**Recommendation:** Submit as UTILITY first (framing: "you have an active subscription"). Fall back to MARKETING if rejected.

---
