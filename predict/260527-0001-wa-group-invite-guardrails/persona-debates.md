# Persona Debates — WA group invite guard rails

Commit: `e4322bac` · Generated: 2026-05-27T00:01Z

---

## Phase 4 — Independent Analysis (no cross-talk)

### Operator (Marcelo's POV)

**OP-1** — Confirmation modal is the only safety net before 32 sends. Severity: HIGH · Confidence: HIGH
- Location: `src/app/dashboard/wa/coverage/page.tsx` (planned bulk button)
- Evidence: spec says `confirmation prompt with checkbox`. A single accidental Enter on the checkbox confirms 32 sends. There is no per-recipient preview, no diff-since-last-send, no "are you sure" double-confirm with the count typed in.
- Recommendation: require typing the recipient count (e.g. "32") into the confirmation input before the button activates. Show first 5 names + "and 27 more" in the modal body.

**OP-2** — No visible group invite URL fingerprint anywhere in the dashboard. Severity: CRITICAL · Confidence: HIGH
- Location: spec §"Environment variable" + page.tsx
- Evidence: `WA_GROUP_INVITE_URL` lives in env. The dashboard never displays it. If a Vercel env was rotated to a test or stale link, the operator has zero chance of catching it before sending.
- Recommendation: surface the current value (or just the path segment after `chat.whatsapp.com/`) at the top of the coverage page. Optionally store a SHA-1 fingerprint in WaSetting and require operator to "acknowledge fingerprint match" once per change.

**OP-3** — No recoverability if wrong link gets sent. Severity: MEDIUM · Confidence: HIGH
- Location: spec §"Goal & scope" — out of scope: detecting joins
- Evidence: WhatsApp cannot recall messages reliably; once 32 messages fire, they're delivered. No "stop the batch" button.
- Recommendation: add a "Pausar batch" button that flips a DB flag mid-loop; the endpoint checks the flag before each send.

**OP-4** — Bulk button is in the same section as the per-row sub list, easy to misclick. Severity: MEDIUM · Confidence: MEDIUM
- Location: spec §"UI changes"
- Evidence: header proximity makes accidental clicks plausible during fast triage.
- Recommendation: visually separate (different background, larger margin) the bulk action from the per-row data.

### Migrations & Data Integrity Engineer

**MIG-1** — `migrate-turso.mjs` has no transaction wrapper around multi-statement migrations. Severity: HIGH · Confidence: HIGH
- Location: `scripts/migrate-turso.mjs:42-77`
- Evidence: each statement is `client.execute(stmt)` independently. If statement 3 of 5 fails, statements 1-2 are committed; the `_prisma_migrations` row is NOT written, so re-running re-applies statements 1-2 (which may fail with "table exists") and never reaches statement 4-5.
- Recommendation: wrap multi-statement migrations in `BEGIN; ... COMMIT;`. Or detect partial application: if any object created by the migration already exists, treat as needing rollback.

**MIG-2** — No backup/snapshot before applying migration to prod. Severity: HIGH · Confidence: HIGH
- Location: `scripts/migrate-turso.mjs` (no pre-step)
- Evidence: Turso has point-in-time recovery, but it's not invoked by the script; a destructive migration (e.g. ALTER TABLE DROP COLUMN) is silently irreversible.
- Recommendation: before applying, dump current schema + a sample of `WaGroupMember` / `WaOutbound` / `WaEvent` to a timestamped file. Refuse to apply if dump fails.

**MIG-3** — Import endpoint deletes the entire roster on every call. Severity: CRITICAL · Confidence: HIGH
- Location: `src/app/api/whatsapp/admin/group-members/import/route.ts:46-50`
- Evidence: `db.waGroupMember.deleteMany({ where: { phoneE164: { notIn: keep } } })` — if `keep` is a small accidental paste (e.g. 5 lines from a copy-paste mishap), 109 rows are deleted. Next coverage Resync sees 80 active subs vs 5 group members → 75 "faltam convidar" → bulk send to 75 people, including everyone already in the group.
- Recommendation: add a hard threshold — if upload count is <50% of current roster size, require an explicit `confirmReplace: true` flag in the request body.

**MIG-4** — Migration file ordering relies on lexicographic sort. Severity: MEDIUM · Confidence: HIGH
- Location: `scripts/migrate-turso.mjs:36-38`
- Evidence: `readdirSync(...).sort()` — fine for the `20260525193738_` timestamp prefix today, but year-2100 or any non-standard prefix would break ordering.
- Recommendation: enforce timestamp-prefix regex; refuse to apply if any directory name doesn't match `^\d{14}_`.

### Bulk-Ops & Distributed Systems Engineer

**BULK-1** — No global outbound kill switch. Severity: CRITICAL · Confidence: HIGH
- Location: `src/lib/wa/config.ts` (only `isWaEnabled` exists, checked only in webhook)
- Evidence: bulk send endpoint won't check `isWaEnabled()`; even if Marcelo flips WA_ENABLED=false to "stop the bot," the bulk send still fires.
- Recommendation: introduce `isOutboundEnabled()` (separate flag `WA_OUTBOUND_ENABLED`). Bulk endpoint refuses to run when false. Default to false on preview deployments.

**BULK-2** — 30-day idempotency check is per-row, race-conditioned across concurrent batches. Severity: HIGH · Confidence: MEDIUM
- Location: spec §"Algorithm" step 4 + DB schema
- Evidence: if the operator clicks "Convidar todos" twice in quick succession (or two admins click simultaneously), each iteration of the second batch reads WaOutbound BEFORE the first batch has written → both batches think no prior send exists → double-send.
- Recommendation: take an exclusive lock — insert a sentinel row in `WaEvent { kind: "BULK_INVITE_LOCK" }` at batch start; refuse to run if a lock from the last 5 min exists. Release at end.

**BULK-3** — No total-send cap per batch. Severity: HIGH · Confidence: HIGH
- Location: spec §"Request body"
- Evidence: endpoint accepts `phoneE164s: string[]` of arbitrary length. A coding bug that passes the whole 80-sub list (instead of just 32 missing) leads to over-sending; passing all 114 group members (mistaken inversion) leads to spamming already-in-group people who could have a degraded experience.
- Recommendation: server-side cap (`if (phoneE164s.length > 100) return 400`) — hard limit by 1.5× expected size. Also assert `phoneE164s.length <= report.missingFromGroup.length + 5` (margin for test sends).

**BULK-4** — Sequential loop has no checkpoint/resume. Severity: MEDIUM · Confidence: HIGH
- Location: spec §"Algorithm" step 4
- Evidence: if the function crashes at iteration 15 of 32, there's no way to resume from 16 — re-running re-sends to 1-15 (caught by 30-day window), but the partial state is invisible.
- Recommendation: persist a `WaBatch { id, plannedPhones, status, startedAt }` row; iterations write `WaBatchItem { batchId, phoneE164, outcome }`. Resume = read incomplete batchItems.

**BULK-5** — No verification that the recipient phones are in the current `missingFromGroup` list. Severity: HIGH · Confidence: HIGH
- Location: spec §"Algorithm" steps 1-4
- Evidence: server trusts the client-provided list. A malicious or buggy admin script can POST any list of phones and send template to them.
- Recommendation: server re-computes coverage; intersects request list with current `missingFromGroup`; rejects anything outside that set. Or: don't accept `phoneE164s` at all — endpoint takes only `{ force, dryRun }` and pulls the list itself.

### Security/Privacy Analyst

**SEC-1** — `WA_GROUP_INVITE_URL` value is never validated as a `chat.whatsapp.com/...` URL. Severity: HIGH · Confidence: HIGH
- Location: spec §"Environment variable"
- Evidence: env var is read and concatenated into template parameter. If anyone with Vercel env access (or via mistake) sets it to a different URL — Telegram link, phishing URL, competitor's group — 32 customers receive that link.
- Recommendation: at endpoint entry, assert `/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/`. Refuse to send if regex fails. Log a `BAD_INVITE_URL_REJECTED` WaEvent.

**SEC-2** — Preview Vercel deployments share Turso DB and Yogo token with production. Severity: HIGH · Confidence: HIGH
- Location: deployment config (no .vercel preview-specific env scoping)
- Evidence: every PR's Vercel preview gets the same `DATABASE_URL`. If anyone with auth opens the preview and clicks Convidar Todos, they hit prod Yogo + prod WhatsApp + prod recipients.
- Recommendation: gate outbound sending on `process.env.VERCEL_ENV === "production"`. Or scope a separate `DATABASE_URL_PREVIEW` for preview deployments.

**SEC-3** — Admin auth is a single cookie value with no MFA, no IP allow-list, no rate limit. Severity: MEDIUM · Confidence: HIGH
- Location: `src/lib/auth.ts:7-11` — `password === process.env.ADMIN_PWD`
- Evidence: anyone who learns the admin password (shared between Ricardo + Marcelo + potential leaks) can trigger bulk send. No "request second confirmation via WhatsApp to Ricardo's phone."
- Recommendation: for destructive/bulk endpoints only, require a second-factor — e.g. a short-lived OTP sent to a known admin phone via the bot itself.

**SEC-4** — `WaOutbound.payload` is stringified JSON containing the recipient name + group URL. Severity: LOW · Confidence: HIGH
- Location: schema.prisma + spec §"Algorithm"
- Evidence: PII at rest. Not a high-magnitude risk (we already store the phone), but worth scoping the payload to just the parameter array, not the full template config.
- Recommendation: store only `{ templateName, language, parameterCount }`, not parameter values. Audit trail without redundant PII.

**SEC-5** — Template approval state is not asserted before bulk. Severity: HIGH · Confidence: MEDIUM
- Location: spec §"Rollout" steps 2-4
- Evidence: nothing prevents an operator from clicking Convidar Todos before Meta has approved the template. The batch will fire and all 32 will get TEMPLATE_PENDING errors → log noise, no actual invite, possible Meta quality score hit.
- Recommendation: a tiny preflight `GET https://graph.facebook.com/v21.0/{WABA_ID}/message_templates?name=convite_grupo_whatsapp` at endpoint start; refuse to send if status !== "APPROVED".

### Devil's Advocate

**DA-1** — All findings focus on code; the most likely "wrong group send" cause is human error rotating the WhatsApp group link without telling anyone. Severity: HIGH · Confidence: HIGH (non-code)
- Location: operational
- Evidence: group invite links can be revoked/regenerated by any group admin from the WhatsApp app. If Marcelo regenerates the link Tuesday and forgets to update Vercel env, the env-stored link 404s for 32 people. Worse: if Ricardo regenerates after Marcelo and a *new* admin gets added unintentionally and rotates again...
- Recommendation: enforce a weekly cron `GET WA_GROUP_INVITE_URL` and check HTTP 200 → log `INVITE_URL_OK`. If 404 / dead link, kill the endpoint until env is refreshed.

**DA-2** — The "missing from group" calculation depends on a manually-pasted WhatsApp roster export. The roster goes stale within hours of being imported. Severity: MEDIUM · Confidence: HIGH
- Location: spec + import/route.ts
- Evidence: WhatsApp doesn't expose group-member lists via API; the only way is the manual export tool. Any join/leave between paste and Convidar Todos creates false positives/negatives.
- Recommendation: display "roster age: 2h" prominently; refuse bulk send if roster age > 7 days; warn at 24h.

**DA-3** — Devil's advocate to majority position that "MARKETING template is the right category". Severity: MEDIUM · Confidence: MEDIUM
- Location: spec §"Meta template"
- Evidence: Meta has aggressive cost differentials between UTILITY and MARKETING (~3-4× in Portugal). For 32 sends/month this is small money, but if Marcelo decides to also invite ex-clients (16) or future cohorts, it grows. Plus MARKETING is more easily flagged/blocked by recipients.
- Recommendation: submit as UTILITY first with the "you have an active subscription" framing → if rejected, fall back to MARKETING. Cost + delivery rate both better.

**DA-4** — Challenge to BULK-2: "exclusive lock prevents the real failure mode." Severity: MEDIUM · Confidence: MEDIUM
- Location: BULK-2 finding
- Evidence: the real failure mode isn't concurrent operators (Marcelo is one person); it's a developer accidentally calling the endpoint from a test/manual fetch while the UI batch is running.
- Recommendation: BULK-2's lock is fine, but reframe as protection against developer testing in prod, not against concurrent UI clicks.

**DA-5** — Non-code: WhatsApp BSP/phone number reputation degrades if 32 cold sends go out and several are reported as spam. Severity: HIGH · Confidence: MEDIUM
- Location: operational
- Evidence: Meta cumulative quality rating per phone number; one bad batch can drop you from HIGH → MEDIUM → LOW → flagged → ban.
- Recommendation: stagger sends across 24h (1 per ~45min) rather than 200ms gap. Monitor `WaEvent` for clusters of failed/`undelivered` callbacks; abort the rest of the batch if quality signals deteriorate.

---

## Phase 5 — Debate Round 1 (cross-examination)

### Migrations Engineer challenges Operator

**→ OP-2** [agree, escalate]: "Surfacing the URL in the dashboard is correct, but only protects against env rotation. The deeper failure is *who has access to rotate the Vercel env*. Migration-style guard: every change to `WA_GROUP_INVITE_URL` should leave an audit trail. Recommend storing the URL in DB (`WaSetting`) with `updatedBy`/`updatedAt`, env var becomes the fallback default."

### Bulk-Ops challenges Migrations

**→ MIG-3** [agree, sharpen]: "The 50% threshold is good but arbitrary. Sharper: any delete > 10 rows triggers a 'soft delete' — mark rows `archivedAt` instead of hard delete; admin reviews and confirms within 24h or rows restore."

### Security challenges Bulk-Ops

**→ BULK-5** [strong agree]: "Server should pull the recipient list itself, not accept it. Endpoint becomes `POST /api/.../group-invite/bulk { force, dryRun }` — no phoneE164s array."

**→ BULK-2** [disagree, reframe]: "Lock should be DB-row based, not WaEvent scan. Use `db.waBatch.create({ id: 'invite' })` with unique constraint conflict = refuse. More reliable than time-window scan of events."

### Operator challenges Security

**→ SEC-3** [partial disagree]: "MFA via WhatsApp OTP is over-engineering for a 3-person team. Stronger guard rail: log every bulk-trigger to a Slack/Telegram webhook so Ricardo sees Marcelo's clicks in real time."

**→ SEC-2** [strong agree, escalate]: "This is the highest-magnitude finding. Preview deployments must NEVER touch prod outbound. Hard-fail in bulk endpoint unless `VERCEL_ENV === 'production'` AND a `KNOWN_PROD_GROUP_FINGERPRINT` constant in code matches the URL last 6 chars."

### Devil's Advocate challenges majority

**→ SEC-1** [concede with condition]: "Regex validation catches non-WhatsApp URLs but not 'wrong WhatsApp group'. Pair SEC-1 with a manual fingerprint confirmation (last 6 chars of link). Operator clicks 'I confirm fingerprint XX YY ZZ' before bulk unlocks for the day. Blends OP-2 + SEC-1 + DA-1."

**→ MIG-1** [disagree, soften]: "libsql has limited DDL transaction support. The real fix: make migration SQL idempotent (`CREATE TABLE IF NOT EXISTS`, etc.) so partial application is recoverable by re-run."

**→ DA-5 self-defense**: 24h staggering is excessive. Compromise: 5min gap between sends → 32 sends complete in ~2.5h.

---

## Phase 5 — Debate Round 2 (synthesis-leaning)

### Operator reflects

- OP-1: keep, sharpen — typed-count + button label `Convidar 32 pessoas` (shows count).
- OP-2: merge into a single combined finding with SEC-1 + DA-1 (URL provenance & integrity).
- OP-3: keep, lower severity to MEDIUM since BULK-4 + 5min gap cover most recovery.
- OP-4: keep at MEDIUM.

### Migrations Engineer reflects

- MIG-1: revised — idempotent SQL + pre-apply linter checks `IF NOT EXISTS` on CREATE/ALTER statements.
- MIG-2: kept HIGH; dump goes to `backups/{timestamp}/`.
- MIG-3: revised per Bulk-Ops — soft-delete with 24h reversal window AND the 50% threshold (defence in depth).
- MIG-4: keep MEDIUM.

### Bulk-Ops reflects

- BULK-1: confirmed CRITICAL. `WA_OUTBOUND_ENABLED` defaults to `false` in non-prod envs.
- BULK-2: revised — DB unique-row lock via `WaBatch { id PK }`.
- BULK-3: keep cap, configurable via `WA_BULK_MAX` (default 100).
- BULK-4: keep, integrates with OP-3.
- BULK-5: confirmed. Endpoint stops accepting client-controlled recipient list.

### Security reflects

- SEC-1: merged into "URL integrity" guard with OP-2 + DA-1.
- SEC-2: confirmed CRITICAL. Single highest-leverage guard.
- SEC-3: revised — Slack/Telegram out-of-band notification in place of MFA.
- SEC-4: keep LOW.
- SEC-5: confirmed; add to preflight checklist.

### Devil's Advocate reflects

- DA-1: merged into URL integrity guard.
- DA-2: confirmed; roster-age banner + refuse if >7d.
- DA-3: minority report; cost optimization, non-blocking.
- DA-4: reframed; BULK-2 mechanism updated.
- DA-5: keep; 5min gap recommended over 200ms.

---

## Anti-Herd Signals (Phase 6 prep)

| Signal | Value | Threshold | Status |
|--------|-------|-----------|--------|
| flip_rate | 0.27 (7 revisions / 26 findings) | >0.8 | PASS |
| entropy | 0.71 (positions diverse) | <0.3 | PASS |
| convergence_speed | 2 rounds | 1=suspicious | PASS |

**Anti-herd: PASSED.** Diverse positions retained; minority opinions (DA-3 cost) preserved.
