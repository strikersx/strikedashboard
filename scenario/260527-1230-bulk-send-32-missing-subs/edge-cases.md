# Edge cases — bulk send, ordered by severity

Cherry-picked from `scenarios.md`. Each is a concrete test case ready to drop into `tests/integration/wa-group-invite-bulk/*.test.ts` once PR-G ships. The most-likely-to-bite-you cases are at the top.

## Critical

| # | Scenario | Bug magnet |
|---|---|---|
| #18 | Two admins click within 1s | Race condition on `WaBatch` unique constraint. Must enforce at DB layer; in-code check is too late. |
| #22 | Meta returns 401 mid-batch | Batch must not get stuck in `status="open"` after auth failure — otherwise next attempt = 409 forever. |
| #23 | Meta template status = REJECTED | Preflight cache TTL boundary. Test PENDING/REJECTED/PAUSED/DISABLED all block; only APPROVED allows. |
| #15 | WA_GROUP_INVITE_URL unset | 400 vs 423 distinction matters for UI banner (config error vs kill switch). |
| #16 | URL shape ok, fingerprint mismatch | Defence-in-depth — env mis-set to a stranger's group invite. |

## High

| # | Scenario | Bug magnet |
|---|---|---|
| #3 | recipients.length = WA_BULK_MAX exactly | Off-by-one on `>` vs `>=`. |
| #4 | recipients.length = MAX + 1 | Audit-row decision — `WaBatch` row created and aborted, or no row at all? Pick one and test it. |
| #6 | lastInvite exactly 30 days ago | Inclusive boundary — `daysSince >= 30` per the helper. Integration test must confirm e2e (not just the unit). |
| #11 | Stale client sends `phoneE164s` | Strict allow-list of body keys, not just block-list. |
| #19 | Pause mid-batch | Where the loop checks the pause flag affects timing. Document. |
| #20 | Resume re-derives recipients | If someone joined the group during the pause, resume must SKIP them. Critical for not-double-sending. |
| #24 | Crash between delete and sendTemplate | Accepted trade-off. Test guards against accidental future "preserve last attempt" semantics. |

## Medium

| # | Scenario | Bug magnet |
|---|---|---|
| #2 | missingFromGroup is empty | UX confusion if button isn't disabled. Endpoint must also refuse with 400 `no_recipients`. |
| #5 | All 32 already skipped | UI must distinguish skipped from failed (separate counters, separate colours). |
| #7 | lastInvite = 29d 23h 59m | Floor-division quirk — operator may need `force: true` to overcome. |
| #8 | force=true | Add `WaEvent kind="BULK_FORCE_OVERRIDE"` so this isn't invisible later. |
| #12 | phoneE164 = null in missingFromGroup | Defensive filter — don't trust computeCoverage's invariant. |
| #13 | displayName is empty | Fallback to `"amigo"`. |
| #17 | Fingerprint confirmed exactly 24h ago | Boundary off-by-one. |
| #21 | Persistent 429 | Two failed retries → outcome `failed` reason `rate_limited`. |
| #25 | Two batches in sequence | Verify unique constraint is `(kind, status="open")` with `status` NOT NULL default `"open"`. |

## Low

| # | Scenario | Bug magnet |
|---|---|---|
| #1 | Happy path 32 phones | Baseline — covers OOB notify, sequential pacing, batch lifecycle. |
| #9 | dryRun=true with all gates green | Validates planning loop without touching Meta. |
| #10 | dryRun=true with G2 off | Preflight still runs (dry-run is no escape hatch). |
| #14 | CJK unicode name | Regex `\s+` doesn't match CJK, so behaviour is correct. Future regression risk if regex tightens. |

## Recommendations

Bake the **Critical** + **High** cases (12 tests) into PR-G as a non-negotiable integration test suite. The **Medium** cases (9) are second-priority — land them in a follow-up PR if PR-G grows too large.

Two of these scenarios surface design ambiguities in the spec that need a written decision before implementation:

1. **#2 / #4** — should `WaBatch` rows be created for aborted-on-preflight cases? (audit value vs noise)
2. **#19** — `total` in the response = attempted or planned? (operator UX)
3. **#23** — what's the cache TTL behaviour on `PENDING`? (re-fetch on every request, or wait 15min?)

Recommend a 30-min spec amendment before starting PR-G.
