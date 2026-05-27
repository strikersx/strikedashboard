---
commit_hash: e4322bac631e5c37fb6dbf9cb1b3c459ae587ac3
analyzed_at: 2026-05-27T00:01:17Z
scope: src/lib/wa/**, src/lib/yogo/**, src/lib/phone.ts, src/lib/db.ts, src/app/api/whatsapp/**, src/app/dashboard/wa/**, prisma/**, scripts/migrate-turso.mjs, docs/superpowers/specs/2026-05-27-wa-group-invite-design.md
files_analyzed: 28
---

## Functions on the bulk-send hot path (planned + existing)

| File | Function | Signature | Lines | Purpose |
|------|----------|-----------|-------|---------|
| src/lib/wa/meta.ts | `sendTemplate` | `(toPhoneE164, templateName, languageCode, bodyParameters) => Promise<SendResult>` | 56-70 | Posts pre-approved Meta template. Returns `{ok, status, body}`. |
| src/lib/wa/meta.ts | `send` | `(toPhoneE164, message) => Promise<SendResult>` | 88-110 | Inner Meta call. Strips leading `+` from recipient. |
| src/lib/wa/group-coverage.ts | `computeCoverage` | `() => Promise<CoverageReport>` | 56- | Reconciles active subs ↔ group roster. Source of `missingFromGroup`. |
| src/lib/wa/group-import.ts | `parseGroupCsv` | `(input: string) => ParseResult` | 16- | Parses pasted TSV/CSV; normalizes phones; flags skips. |
| src/lib/yogo/recurring-subs.ts | `fetchActiveRecurringSubs` | `() => Promise<ActiveRecurringSub[]>` | 21- | Yogo customers × memberships joined on user_id; status==="active" only. |
| src/lib/yogo/recurring-subs.ts | `fetchAllYogoCustomers` | `() => Promise<YogoCustomerLite[]>` | 67- | Union of hasNoMembership + hasMembershipOrClassPass(ALL_SUB_IDS). |
| src/lib/phone.ts | `normalize` | `(input: string) => NormalizedPhone` | 12- | Returns `{e164, variants[]}` — PT-aware (12-digit intl, 9-digit national). |

## Models / Database

| Name | File | Fields | Unique Constraints |
|------|------|--------|-------------------|
| WaGroupMember | prisma/schema.prisma | phoneE164 (PK), savedName, publicName, isMyContact, isBusiness, labels | phoneE164 only |
| WaOutbound | prisma/schema.prisma | id (PK), phoneE164, kind, payload, status, error, templateKey, sentAt | `@@unique([phoneE164, templateKey])` |
| WaEvent | prisma/schema.prisma | id (PK), kind, phoneE164, meta, createdAt | none |

## Env vars touched by the planned feature

| Var | Source | Risk if wrong |
|-----|--------|---------------|
| `WA_GROUP_INVITE_URL` | env (new) | **wrong group invite sent to 32 people** |
| `WA_ACCESS_TOKEN` | env (existing) | auth fails; batch aborts |
| `WA_PHONE_NUMBER_ID` | env (existing) | send fails |
| `YOGO_TOKEN` | env (existing) | recipient list wrong (Yogo 401) |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | env (existing) | wrong roster source (e.g. preview Turso vs prod) |
| `WA_ENABLED` | env (existing) | kill switch — only applies to inbound, NOT to outbound bulk send (gap) |

## Routes / Endpoints in scope

| Method | Path | File | Auth | Notes |
|--------|------|------|------|-------|
| POST | /api/whatsapp/admin/group-invite/bulk | planned | admin | bulk-send endpoint per spec |
| GET | /api/whatsapp/admin/group-coverage | exists | admin | feeds the missing list |
| POST | /api/whatsapp/admin/group-members/import | exists | admin | replaces full WaGroupMember roster on each call |
| POST | /api/whatsapp/admin/reset-session | exists | admin | reference pattern for admin endpoints |

## Migration tool: scripts/migrate-turso.mjs

Reads `prisma/migrations/<dir>/migration.sql`, splits on `;\n`, executes each statement against Turso, records in `_prisma_migrations`. No transaction wrapping. No DDL safety guard (e.g. ALTER TABLE DROP is allowed silently).
