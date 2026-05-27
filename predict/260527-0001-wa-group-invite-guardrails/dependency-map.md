---
commit_hash: e4322bac631e5c37fb6dbf9cb1b3c459ae587ac3
---

## Data flow: bulk-send hot path (planned)

| Source | Transform | Sink | Risk areas |
|--------|-----------|------|------------|
| `WA_GROUP_INVITE_URL` env | trusted as-is | template parameter `{{2}}` | **wrong URL = wrong group**; no validation that URL is a `chat.whatsapp.com/` link; no fingerprint stored |
| `fetchActiveRecurringSubs()` output | filter by `status==="active"` | `missingFromGroup` candidate list | strict status filter; Yogo's `status_text` field could disagree with `status` |
| `WaGroupMember` table rows | phone-variant matching | exclude from missing list | roster freshness: stale import → false "missing" (re-invite) |
| Yogo `customer.phone` (raw string) | `normalize()` | E.164 | normalize accepts 9-digit national → may match wrong country code if data shifts |
| Pasted CSV/TSV from operator | `parseGroupCsv` | upsert WaGroupMember | **`replaceAll` semantics: import deletes anything not in upload — operator paste mistake nukes roster** |
| `WA_ACCESS_TOKEN` | direct fetch header | Meta API | secret leakage via WaOutbound.payload if accidentally logged |
| Phone in WaOutbound payload | `JSON.stringify` | DB column | PII at rest in plaintext |

## Call graph (planned + existing)

| Caller | Callee | File:Line | Notes |
|--------|--------|-----------|-------|
| /api/whatsapp/admin/group-invite/bulk (planned) | sendTemplate | (planned) | sequential 200ms gap |
| /api/whatsapp/admin/group-invite/bulk (planned) | fetchAllYogoCustomers | recurring-subs.ts:67 | name resolution |
| /api/whatsapp/admin/group-invite/bulk (planned) | db.waOutbound.upsert/delete | (planned) | idempotency check + record |
| /api/whatsapp/admin/group-members/import | db.waGroupMember.deleteMany | import/route.ts:48 | **destructive: drops all rows not in upload** |
| /api/whatsapp/admin/group-coverage | computeCoverage | route.ts | feeds missing list |
| computeCoverage | fetchActiveRecurringSubs + fetchAllYogoCustomers + db.waGroupMember.findMany | group-coverage.ts | three I/O ops in parallel |
| sendTemplate | fetch graph.facebook.com | meta.ts:95 | no retry on 5xx; no timeout |

## Control flow gaps

- `isWaEnabled()` (WA_ENABLED killswitch) is checked ONLY in webhook/route.ts — **not in any outbound code path**, so muting the bot does NOT mute bulk send.
- No environment-aware safety (e.g. preview vs production) in the bulk-send endpoint.
- No "dry-run by default in non-prod" guard.
