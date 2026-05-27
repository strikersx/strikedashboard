# WA Group Invite Guard Rails — Meta-Plan (7 PRs)

> **For agentic workers:** This is the master plan. Each PR below has (or will have) its own detailed plan at `docs/superpowers/plans/2026-05-27-wa-guardrails-<letter>-<name>.md`. Use `superpowers:subagent-driven-development` per sub-plan.

**Goal:** Implement the full G1-G13 guard-rail spec (`docs/superpowers/specs/2026-05-27-wa-group-invite-design.md`, revised after `/autoresearch:predict`) plus the six existing-code findings from `predict/260527-0001-wa-group-invite-guardrails/handoff-fix-existing.md`.

**Strategy:** 7 mergeable PRs, sequenced in 3 waves so independent work can land in parallel and the high-risk bulk-endpoint refactor lands last.

**Tech stack:** Next.js 15 App Router, Prisma + Turso/SQLite, Vitest, Meta Cloud API, Tailwind-free inline UI.

---

## Sequencing

```
Wave 1 (parallel — independent helpers + ops):
  PR-A: Config helpers       (src/lib/wa/config.ts)
  PR-B: notifyAdmin helper   (src/lib/wa/notify.ts)
  PR-D: Migration runner     (scripts/migrate-turso.mjs)
  PR-E: WaOutbound payload   (audit waOutbound.create sites)

Wave 2 (depends on Wave 1):
  PR-C: Roster soft-delete   (WaGroupMember.archivedAt)
  PR-F: URL health cron      (HEAD WA_GROUP_INVITE_URL hourly + WaEvent)

Wave 3 (depends on Waves 1 + 2):
  PR-G: Bulk endpoint G1-G13 refactor
    - Replaces the endpoint currently on PR #18 / branch feat/wa-group-invite
    - Server-derived recipients (G7), preflight gates, WaBatch lock,
      pause/resume, 5-minute gap, fingerprint UI, typed-count modal.
```

---

## PR-A — Config helpers

**Source:** Handoff PR 1 (H-03) + PR 2 (G3, G4).

**Branch:** `feat/wa-config-guards` off `main`.

**Changes (single file: `src/lib/wa/config.ts`):**
- Add `isOutboundEnabled(): boolean` reading `WA_OUTBOUND_ENABLED === "true"`.
- Add `INVITE_URL_FINGERPRINT_PROD` constant (placeholder `"AbCdEf"` — Ricardo updates when prod link is rotated).
- Add `validateInviteUrl(url, fingerprint): { ok: true } | { ok: false, reason: "shape" | "fingerprint" }`.
  - Regex shape: `^https://chat\.whatsapp\.com/[A-Za-z0-9]{15,30}(\?.*)?$` (accepts the tracking-param suffix the real link has).
  - Fingerprint: `url.includes(fingerprint)` (the path portion is what matters).

**Tests:** `tests/lib/wa/config.test.ts` — extend existing file with truth-tables for both helpers.

**Verification:** `npx vitest run tests/lib/wa/config.test.ts`, `npx tsc --noEmit`.

**Acceptance:** No existing caller is touched (additive). Future PRs import these.

---

## PR-B — notifyAdmin helper

**Source:** Handoff PR 6 (H-11).

**Branch:** `feat/wa-notify` off `main`.

**Changes:**
- New file `src/lib/wa/notify.ts`:
  - `notifyAdmin(message: string, kind: string): Promise<void>` reads `RICARDO_PHONE_E164`, calls `sendText`, logs `OOB_NOTIFY_OK` / `OOB_NOTIFY_FAIL` to `WaEvent`. Never throws.
- `.env.example`: document `RICARDO_PHONE_E164`.

**Tests:** `tests/lib/wa/notify.test.ts` — vi.hoisted mocks for `sendText` + `db.waEvent`; verify both branches and the no-throw guarantee.

**Verification:** vitest + tsc.

**Acceptance:** Helper exists, no callers wired yet (those land in PR-G).

---

## PR-D — Migration runner safety

**Source:** Handoff PR 4 (H-08, H-17).

**Branch:** `feat/migrate-turso-safety` off `main`.

**Changes (single file: `scripts/migrate-turso.mjs` + new `scripts/turso-dump.mjs`):**
- Pre-apply linter scan: each statement must contain `IF NOT EXISTS` (CREATE TABLE/INDEX/UNIQUE) or `IF EXISTS` (DROP). Otherwise fail-fast.
- Pre-apply dump via new `scripts/turso-dump.mjs > backups/{ts}-{commit}.sql`. Refuse to APPLY if dump fails.
- Prefix validation: refuse if any `prisma/migrations/<dir>` doesn't match `^\d{14}_[a-z0-9_]+$`.
- `--dry-run` flag.
- `--verify` flag: re-read `_prisma_migrations` post-apply.

**Tests:** Manual — run with deliberately-malformed dir; run with non-idempotent statement.

**Verification:** `node scripts/migrate-turso.mjs --dry-run` on current Turso reports clean.

**Acceptance:** No behavioural change for valid migrations; bad migrations now blocked.

---

## PR-E — WaOutbound payload PII minimisation

**Source:** Handoff PR 5 (H-18).

**Branch:** `feat/wa-outbound-pii-min` off `main`.

**Changes:**
- Audit every `db.waOutbound.create({ data: { payload: ... } })` site.
- Replace full-args payload with `JSON.stringify({ templateName, language, parameterCount })`.
- Sites to touch (preliminary scan; verify before editing): `src/app/api/cron/trial-followup/route.ts` + any other outbound writer.

**Tests:** Grep audit (`grep -rn "waOutbound.create"`) confirms no PII fields remain.

**Acceptance:** Audit trail less detailed but PII-free.

---

## PR-C — WaGroupMember soft-delete

**Source:** Handoff PR 3 (H-04, H-12).

**Branch:** `feat/wa-roster-soft-delete` off `main`. **Depends on Wave 1** (uses no Wave 1 helpers, but lands later to keep diffs small).

**Changes:**

1. **Schema** (`prisma/schema.prisma`):
   ```prisma
   model WaGroupMember {
     // existing fields...
     archivedAt DateTime?
     @@index([archivedAt])
   }
   ```
2. **Migration** at `prisma/migrations/<ts>_wa_group_member_archived_at/migration.sql`:
   ```sql
   ALTER TABLE WaGroupMember ADD COLUMN archivedAt DATETIME;
   CREATE INDEX IF NOT EXISTS WaGroupMember_archivedAt_idx ON WaGroupMember(archivedAt);
   ```
3. **`src/app/api/whatsapp/admin/group-members/import/route.ts`:**
   - Change `deleteMany` → `updateMany({ where: { phoneE164: { notIn: keep } }, data: { archivedAt: now } })`.
   - Threshold guard: if `parsed.rows.length < currentNonArchivedCount * 0.5` and `!body.confirmReplace` → return 412 `large_delete_requires_confirmReplace` with `{ currentCount, proposedCount, willArchive }`.
4. **`src/lib/wa/group-coverage.ts`:** filter `archivedAt: null` on the `findMany`.
5. **New endpoint `POST /api/whatsapp/admin/group-members/restore`:** `{ phoneE164s }` flips `archivedAt = null`.
6. **UI** (`src/app/dashboard/wa/coverage/page.tsx`):
   - Surface the 412 response with `[Confirmar substituição]` button that re-submits with `confirmReplace: true`.
   - Roster-age badge: amber > 24h, red > 7d (sets up G9 visual; the endpoint check lands in PR-G).

**Tests:** Existing import-route tests + new threshold-guard tests; restore endpoint integration test.

**Verification:** Migrate Turso clone; coverage page still shows 114 members.

**Acceptance:** A bad paste no longer nukes the roster.

---

## PR-F — URL health check cron

**Source:** Spec G6.

**Branch:** `feat/wa-invite-url-health` off `main`. **Depends on PR-A** (uses `validateInviteUrl`).

**Changes:**
- New `src/app/api/cron/wa-invite-url-health/route.ts`: bearer-auth gated (existing `CRON_SECRET`), runs `HEAD WA_GROUP_INVITE_URL`, logs `INVITE_URL_OK` (response 200/302) or `INVITE_URL_DEAD` (anything else) to `WaEvent`.
- Schedule in `vercel.json`: every 6h.

**Tests:** Manual against the prod URL; integration test stubs fetch.

**Acceptance:** Most-recent `INVITE_URL_OK` event in `WaEvent` is ≤ 6h old when prod link is live.

---

## PR-G — Bulk endpoint G1-G13 refactor

**Source:** Spec sections "Endpoint", "UI changes", "Data flow", "Error handling".

**Branch:** `feat/wa-invite-guardrails-bulk` off `main`. **Depends on PRs A, B, C, F.**

**Replaces** the bulk endpoint currently on PR #18. Either:
- (a) Land this PR first, then close #18 as superseded; or
- (b) Merge #18 first as MVP, then land this as a follow-up rewrite.

Recommendation: **(a)**. PR #18's contract (`phoneE164s` from client) is incompatible with G7. Shipping #18 and then immediately rewriting it doubles the review cost.

**Changes (large — broken into 12+ subtasks in its own plan):**

1. **Schema** — add `WaBatch`, `WaBatchItem`, `WaSetting` models per spec.
2. **Endpoint refactor** `src/app/api/whatsapp/admin/group-invite/bulk/route.ts`:
   - Request body shrinks to `{ force?, dryRun? }`. Any other top-level key → 400 `unexpected_recipient_field`.
   - Preflight gate: G1, G2, G3, G4, G5, G6, G9, G10 (each returns its specific error code).
   - G11 lock via unique `(kind, status="open")` on `WaBatch`.
   - Re-derive recipients via `computeCoverage().missingFromGroup`.
   - G8 cap via `WA_BULK_MAX` env (default 100).
   - G13 OOB notify via `notifyAdmin`.
   - Sequential send with **5-minute** randomized gap (3-7 min).
   - Pause check between sends.
   - `WaBatchItem` row per attempt.
   - Close batch at end.
3. **New endpoints:**
   - `GET /api/whatsapp/admin/invite-url-fingerprint` — returns last 6 chars.
   - `POST /api/whatsapp/admin/invite-url-confirm` — writes `WaSetting`.
   - `GET /api/whatsapp/admin/group-invite/bulk/:batchId` — batch progress polling.
   - `POST .../pause` — set batch status="paused".
4. **UI refactor** `src/app/dashboard/wa/coverage/page.tsx`:
   - Header strip: fingerprint badge + "Confirmo" button, roster-age badge, URL-health badge.
   - "Faltam convidar" section: typed-count modal, force + dry-run checkboxes.
   - Progress modal that stays open during batch, polling every 3s. Pause button.
   - Per-row `lastInvite` badges (carried over from PR #18 idea, derived from latest `WaOutbound`).

**Tests:** Unit + integration (each of the 11 preflight failure paths each return their expected code with no side-effects); pause→resume; concurrent-batch test.

**Verification:** Deploy to preview → G1 and G2 should fail by design (preview is not prod, kill switch unset). Production deploy → operator confirms fingerprint → first run is dry → second run real.

**Acceptance:** Bulk send only fires when all 11 preflight gates green; batch state visible in DB + UI; pause/resume work.

---

## Rollout sequencing

1. **Day 0:** Land Wave 1 (PRs A, B, D, E) in parallel.
2. **Day 0-1:** Land Wave 2 (PRs C, F).
3. **Day 1-2:** Implement and review PR-G. Ship to preview.
4. **Day 2:** Ricardo updates `INVITE_URL_FINGERPRINT_PROD` constant with the real last-6-chars of the prod invite URL, ships small follow-up PR. Sets `WA_OUTBOUND_ENABLED=true` in Vercel Production only.
5. **Day 2+:** Smoke test in prod — confirm preflight gates fire correctly; dry-run bulk; real bulk.

---

## Files touched (master list)

```
src/lib/wa/config.ts                                          (PR-A)
src/lib/wa/notify.ts                                          (PR-B, new)
src/app/api/whatsapp/admin/group-invite/bulk/route.ts         (PR-G, replace)
src/app/api/whatsapp/admin/group-members/import/route.ts      (PR-C)
src/app/api/whatsapp/admin/group-members/restore/route.ts     (PR-C, new)
src/app/api/whatsapp/admin/invite-url-fingerprint/route.ts    (PR-G, new)
src/app/api/whatsapp/admin/invite-url-confirm/route.ts        (PR-G, new)
src/app/api/whatsapp/admin/group-invite/bulk/[batchId]/route.ts (PR-G, new)
src/app/api/whatsapp/admin/group-invite/bulk/[batchId]/pause/route.ts (PR-G, new)
src/app/api/cron/wa-invite-url-health/route.ts                (PR-F, new)
src/app/dashboard/wa/coverage/page.tsx                        (PR-C, PR-G)
src/lib/wa/group-coverage.ts                                  (PR-C, PR-G)
src/app/api/cron/trial-followup/route.ts                      (PR-E)
prisma/schema.prisma                                          (PR-C, PR-G)
prisma/migrations/<ts>_wa_group_member_archived_at/           (PR-C)
prisma/migrations/<ts>_wa_batch_invite/                       (PR-G)
scripts/migrate-turso.mjs                                     (PR-D)
scripts/turso-dump.mjs                                        (PR-D, new)
vercel.json                                                   (PR-F)
.env.example                                                  (PR-B, PR-G)
tests/lib/wa/config.test.ts                                   (PR-A)
tests/lib/wa/notify.test.ts                                   (PR-B, new)
```

---

## What happens to PR #18

PR #18 is the original-spec implementation (no guard rails). It is **functional but incomplete** against the revised spec. Two paths:

- **Recommended:** Close #18 as superseded once PR-G lands. The PR-G refactor reuses the pure helpers from `src/lib/wa/group-invite.ts` (idempotency, formatInviteParams, summarizeDetails) so the work isn't entirely thrown away.
- **Alternative:** Merge #18 first to get a working bulk path (with the cap, dedup, abort flag, etc.), then land Waves 1-2-3 incrementally as hardening.

Either way the META-PLAN's PRs are the path to the revised spec.
