# Handoff: fix existing code (parallel to invite feature)

**Purpose:** Document the predict findings that target **already-shipped code paths**, separate from the new invite feature. These are the fixes a future `/autoresearch:fix` chain (or a hand-written PR series) should sequence. They are prerequisites or co-requisites for the invite feature spec at `docs/superpowers/specs/2026-05-27-wa-group-invite-design.md`.

**Commit at time of analysis:** `e4322bac`
**Source findings:** `predict/260527-0001-wa-group-invite-guardrails/findings.md` (this directory)
**Personas in agreement:** 4-5 of 5 on every item below.

---

## Why a separate handoff

The invite-feature spec describes **new** code (bulk endpoint, UI, DB tables). But six of the predict findings expose risks in code that already lives in `main`:

| Finding | Existing code | Risk in production today |
|---------|---------------|--------------------------|
| H-03 | `src/lib/wa/config.ts` | No outbound kill switch — future outbound bug ships hot |
| H-04 | `src/app/api/whatsapp/admin/group-members/import/route.ts` | Bad CSV paste nukes the entire WaGroupMember roster |
| H-08 | `scripts/migrate-turso.mjs` | Migration partial-application is silently corrupting `_prisma_migrations` |
| H-17 | `scripts/migrate-turso.mjs` | Migration ordering breaks if any dir name skips the timestamp prefix |
| H-18 | `prisma/schema.prisma` + `src/lib/wa/dispatch.ts` etc. | `WaOutbound.payload` stores PII redundantly |
| H-16 | `src/lib/auth.ts` | Single-factor admin cookie (paired with H-11 OOB notify) |

The invite feature spec consumes outputs from these fixes (specifically `archivedAt` column on WaGroupMember, `isOutboundEnabled()` helper, `INVITE_URL_FINGERPRINT_PROD` constant). The invite-feature PR can either:

1. Land **after** these existing-code fixes, treating them as prerequisites; or
2. Land **in parallel**, importing the same lib changes within its own PR.

Recommendation: option 1. Each existing-code fix is small, has its own test surface, and is mergeable independently. Option 2 risks a large bundled PR with multiple concerns.

---

## PR-by-PR plan

### PR 1: outbound kill switch (`src/lib/wa/config.ts`)
**Findings:** H-03

**Changes:**
- Add `isOutboundEnabled()` returning `process.env.WA_OUTBOUND_ENABLED === "true"`.
- Set `WA_OUTBOUND_ENABLED=true` in Vercel **Production env only**. Leave preview/dev unset.
- No code currently calls it; future outbound sites (bulk endpoint, future cron sends) will guard on it.

**Verification:**
- `npm run typecheck` passes.
- Unit test: `isOutboundEnabled()` true/false/unset/"false"/"True"/" true".
- No behavioural change for inbound webhook (`isWaEnabled()` unchanged).

**Risk if regressed:** None — additive helper, no existing callers.

---

### PR 2: invite URL fingerprint constant (also in `src/lib/wa/config.ts`)
**Findings:** H-05 (defence in depth for the invite feature)

**Changes:**
- Add `export const INVITE_URL_FINGERPRINT_PROD = "AbCdEf"` placeholder. Ricardo updates with the real value when the prod group invite link is generated.
- Add `export function validateInviteUrl(url: string): { ok: true } | { ok: false; reason: "shape" | "fingerprint" }` helper used by the bulk endpoint.

**Verification:**
- Unit test: shape regex accepts `https://chat.whatsapp.com/XYZ123abc456def78`, rejects Telegram/HTTP/empty/null. Fingerprint compare passes/fails as expected.

**Risk if regressed:** None — no existing callers.

---

### PR 3: roster soft-delete (`prisma/schema.prisma` + `import/route.ts`)
**Findings:** H-04, H-12

**Changes:**
1. Schema: add `archivedAt DateTime?` to `WaGroupMember` + `@@index([archivedAt])`.
2. Migration: idempotent `ALTER TABLE WaGroupMember ADD COLUMN archivedAt DATETIME`.
3. `import/route.ts` change `deleteMany` → `updateMany({ data: { archivedAt: now } })`.
4. `findMany` callers (notably `group-coverage.ts`) filter `archivedAt: null`.
5. Threshold guard: refuse import if `parsed.rows.length < currentNonArchivedCount * 0.5` without `body.confirmReplace === true`. Return 412 with `{ currentCount, proposedCount, willArchive }`.
6. New endpoint `POST /api/whatsapp/admin/group-members/restore { phoneE164s }` flips `archivedAt = null`.

**Verification:**
- Migration applies cleanly on a Turso clone (use `backups/{ts}.sql` snapshot before applying).
- Existing coverage page still shows 114 members.
- Integration test: importing a 5-row CSV with current roster of 114 returns 412 unless `confirmReplace: true`.
- Integration test: importing a 60-row CSV (>50%) is accepted; the 54 not-in-upload rows have `archivedAt` set; `restore` endpoint flips them back.

**Risk if regressed:** Reverting `archivedAt = null` is trivial; reverting `deleteMany → updateMany` is a 1-line revert. Worst case: roster contains archived rows surface in coverage; coverage `findMany` filter mitigates.

---

### PR 4: migration runner safety (`scripts/migrate-turso.mjs`)
**Findings:** H-08, H-17

**Changes:**
1. Pre-apply linter scan: each statement must contain `IF NOT EXISTS` (CREATE TABLE/INDEX/UNIQUE) or `IF EXISTS` (DROP). Fail-fast with a clear error pointing to the offending statement.
2. Pre-apply schema dump: `node scripts/turso-dump.mjs > backups/{ts}-{commit}.sql`. (New helper script.) Refuse to APPLY if dump fails.
3. Prefix validation: refuse if any directory in `prisma/migrations/` doesn't match `^\d{14}_[a-z0-9_]+$`.
4. Add `--dry-run` flag: print parsed statements + lint result, do not execute.
5. Add `--verify` flag after APPLY: re-read `_prisma_migrations` and `sqlite_master` to confirm migration is fully applied.

**Verification:**
- Run `node scripts/migrate-turso.mjs --dry-run` against the current Turso → reports current state, no writes.
- Run `node scripts/migrate-turso.mjs` against a Turso clone with a deliberately-malformed migration directory name → script exits non-zero before any SQL runs.
- Run with a non-idempotent statement (e.g. plain `CREATE TABLE foo`) → linter blocks.

**Risk if regressed:** Failed migrations are visible (error exit code, no `_prisma_migrations` row written). Worst case: the backup dump becomes the recovery path.

---

### PR 5: payload PII minimisation (`prisma/schema.prisma` callers)
**Findings:** H-18

**Changes:**
- Audit every `db.waOutbound.create` call. Replace `payload: JSON.stringify({...full args...})` with `payload: JSON.stringify({ templateName, language, parameterCount })`.
- Migration: optionally one-shot rewrite existing rows.

**Verification:**
- Grep for `waOutbound.create` and `waOutbound.update`; confirm no PII fields in `payload`.

**Risk if regressed:** Audit trail less detailed but consistent. Low.

---

### PR 6: out-of-band notification helper (paired with H-11 in the invite feature)
**Findings:** H-11 + H-16 mitigation

**Changes:**
- New `src/lib/wa/notify.ts`: `notifyAdmin(message: string, kind: string)`. Reads `RICARDO_PHONE_E164`, calls `sendText`, logs `OOB_NOTIFY_OK` / `OOB_NOTIFY_FAIL` to WaEvent.
- The invite-feature bulk endpoint imports and calls this before batch start.
- Also good idea: webhook DISPATCH_FAIL events trigger `notifyAdmin` as a side benefit (out of scope for this PR but easy follow-up).

**Verification:**
- Manual: call `notifyAdmin("test", "TEST")` from a one-off script; Ricardo receives the message; WaEvent has `OOB_NOTIFY_OK`.

**Risk if regressed:** Notification fails are logged, never block the calling code.

---

## Suggested sequencing

```
PR 1 (config) ─┐
PR 2 (config) ─┴─► PR 3 (roster soft-delete) ─► PR 6 (notify) ─► [invite feature PR] ─► Day-1 cutover
PR 4 (migrate) ────────────────────────────────────────────────► (independent, can land anytime)
PR 5 (payload) ────────────────────────────────────────────────► (independent, can land anytime)
```

PRs 1, 2, 4, 5 are independent and can land in any order. PR 3 must precede the invite feature because the spec assumes `archivedAt` exists. PR 6 must precede the invite feature because the bulk endpoint imports `notifyAdmin`.

---

## Re-running predict after fixes land

Once PRs 1-6 land:

```bash
/autoresearch:predict
Scope: src/lib/wa/**, src/lib/yogo/**, src/app/api/whatsapp/**, src/app/dashboard/wa/**, scripts/migrate-turso.mjs
Goal: Verify guard rails landed and no new gaps introduced
Depth: shallow
```

A 3-persona shallow re-run should report all H-03, H-04, H-08, H-12, H-17, H-18 as `RESOLVED`. Any remaining findings or new ones are the input for the next iteration.

---

## What `/autoresearch:fix` would consume from this doc

If chained: each PR section above maps to one fix-loop iteration:
- **Target:** PR title (e.g. "outbound kill switch")
- **Scope:** files listed in the PR section
- **Cascade hints:** the "Risk if regressed" line
- **Acceptance:** the "Verification" bullet list

The `handoff.json` at `predict/260527-0001-wa-group-invite-guardrails/handoff.json` already encodes the underlying findings with `location` fields. The PR-by-PR plan above is the operator-readable view of the same data.
