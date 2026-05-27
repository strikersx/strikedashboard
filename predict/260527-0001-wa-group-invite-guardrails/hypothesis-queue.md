# Hypothesis Queue — WA Group Invite Guard Rails

For consumption by downstream chain (`/autoresearch:fix`, `/autoresearch:debug`, or `writing-plans`).

| Rank | ID | Hypothesis | Severity | Confidence | Location | Source Persona |
|------|----|------------|----------|------------|----------|----------------|
| 1 | H-01 | Preview Vercel deployments fire real prod sends because env is unscoped | CRITICAL | HIGH | Vercel env config | Security (5/5) |
| 2 | H-02 | Client-controlled recipient list lets any caller bypass the missing-list derivation | CRITICAL | HIGH | planned bulk endpoint | Bulk-Ops (5/5) |
| 3 | H-03 | `WA_ENABLED` killswitch is checked only in inbound webhook, not in any outbound path | CRITICAL | HIGH | `lib/wa/config.ts:4-6` | Bulk-Ops (5/5) |
| 4 | H-04 | Import endpoint hard-deletes all rows not in upload → small-paste mistake spams entire roster | CRITICAL | HIGH | `import/route.ts:46-50` | Migrations (5/5) |
| 5 | H-05 | `WA_GROUP_INVITE_URL` env can be replaced silently with no integrity guard | CRITICAL | HIGH | spec §"Env" | Security (5/5) |
| 6 | H-06 | Concurrent bulk clicks can double-send because idempotency is read-then-write per row | HIGH | MEDIUM | spec §"Algorithm" | Bulk-Ops (4/5) |
| 7 | H-07 | Endpoint accepts any-length `phoneE164s` → buggy caller can exceed expected scope | HIGH | HIGH | spec §"Request body" | Bulk-Ops (5/5) |
| 8 | H-08 | `migrate-turso.mjs` partial-applies on statement failure; subsequent runs leave migration stuck mid-way | HIGH | HIGH | `scripts/migrate-turso.mjs:42-77` | Migrations (4/5) |
| 9 | H-09 | Template send proceeds even when Meta template is PENDING → 32 sends fail loudly | HIGH | MEDIUM | `lib/wa/meta.ts:56-70` | Security (4/5) |
| 10 | H-10 | Confirmation modal accepts single Enter; muscle-memory click triggers 32 sends | HIGH | HIGH | spec §"UI" | Operator (5/5) |
| 11 | H-11 | No out-of-band notification → bulk-trigger goes unseen by Ricardo for hours | HIGH | HIGH | (new) | Operator (4/5) |
| 12 | H-12 | Stale roster (>7d) drives mis-targeting because UI never enforces freshness | HIGH | HIGH | `WaGroupMember.importedAt` | Devil's Advocate (4/5) |
| 13 | H-13 | Tight 200ms-gap loop has no checkpoint; crash at iter 15/32 = invisible partial state | MEDIUM | HIGH | spec §"Algorithm" | Bulk-Ops (4/5) |
| 14 | H-14 | 200ms inter-send gap risks WABA quality-rating degradation on cold sends | MEDIUM | MEDIUM | spec §"Algorithm" | Devil's Advocate (3/5) |
| 15 | H-15 | Bulk button in same section header as sub list invites misclicks | MEDIUM | MEDIUM | spec §"UI" | Operator (3/5) |
| 16 | H-16 | Admin auth is single-factor cookie; compromise = full bulk capability | MEDIUM | HIGH | `lib/auth.ts:7-11` | Security (3/5) |
| 17 | H-17 | Migration ordering relies on lexicographic sort with no prefix validation | MEDIUM | HIGH | `scripts/migrate-turso.mjs:36-38` | Migrations (3/5) |
| 18 | H-18 | `WaOutbound.payload` stores full template parameters incl. PII redundantly | LOW | HIGH | schema.prisma | Security (3/5) |
| 19 | H-19 (minority) | MARKETING template costs ~3-4× UTILITY in Portugal; may be miscategorised | LOW | MEDIUM | spec §"Meta template" | Devil's Advocate (2/5) |
