# Scenarios — bulk send 32 missing subscribers

Each entry is a self-contained test scenario. Map directly into `tests/integration/wa-group-invite-bulk/*.test.ts` once PR-G ships.

Conventions:
- **Severity** — Critical / High / Medium / Low (impact if not handled)
- **Maps to gate** — which G* requirement covers this
- **Test outline** — concrete `describe / it` outline + the key assertions

---

## #1 — [happy_path] All gates green, 32 phones, all new sends

**Severity:** Low (baseline)
**Maps to gate:** none (the success path)

**Given:**
- All preflight conditions baseline (overview.md)
- 32 phones in `computeCoverage().missingFromGroup`, each with valid `phoneE164`
- All 32 have no prior `WaOutbound` row with `templateKey="grp_invite"`
- Meta `sendTemplate` returns `{ ok: true, status: 200 }` for each

**When:**
- Admin POSTs `{ force: false, dryRun: false }`

**Then:**
- HTTP 200
- Response: `{ batchId, total: 32, sent: 32, skipped: 0, failed: 0, aborted: false, details: [...32...] }`
- `WaBatch` row: `kind="invite"`, `status="done"`, `recipients=32`, `finishedAt` set
- 32 `WaBatchItem` rows with `outcome="sent"`, `processedAt` set
- 32 `WaOutbound` rows: `status="sent"`, `templateKey="grp_invite"`
- 32 `WaEvent` rows: `kind="GROUP_INVITE_SENT"`
- 1 `WaEvent` row: `kind="OOB_NOTIFY_OK"`
- Total elapsed time roughly `32 × random(3-7min)` ≈ 96-224 min

**Edge factors:** None — this is the baseline to compare every other scenario against.

**Test outline:**
```ts
describe("bulk endpoint — happy path 32 phones", () => {
  it("returns 200, marks batch done, persists 32 WaBatchItem and 32 WaOutbound rows", async () => {
    /* mock sendTemplate ok x32, fast-forward timers through the 5min gaps */
  });
});
```

---

## #2 — [edge_case] missingFromGroup is empty (0 phones)

**Severity:** Medium (UX surprise + audit row noise)
**Maps to gate:** spec is silent — UI button should be disabled when count=0, but the endpoint must also refuse

**Given:**
- Baseline preflight green
- `computeCoverage().missingFromGroup.length === 0` (everyone is covered)

**When:**
- Admin POSTs `{ force: false, dryRun: false }` (e.g. raced against another admin who just imported a roster covering everyone)

**Then:**
- HTTP 400 `no_recipients`
- NO `WaBatch` row created (or row created and immediately aborted — pick one, document)
- NO Meta API call
- NO OOB notify (or "0 destinatários" notification — spec ambiguous; recommend skipping the notify to avoid noise)

**Edge factors:** Zero is a valid count and must not crash any downstream consumer (`summarizeDetails([])` returns zeros — already covered by unit test).

**Test outline:**
```ts
it("returns 400 no_recipients when missingFromGroup is empty and does not create a batch row", async () => {
  /* stub computeCoverage → [] */
});
```

---

## #3 — [edge_case] missingFromGroup count = WA_BULK_MAX exactly (boundary)

**Severity:** High (off-by-one risk on the cap)
**Maps to gate:** G8

**Given:**
- WA_BULK_MAX=100 (default)
- `missingFromGroup.length === 100`

**When:**
- Admin POSTs bulk request

**Then:**
- HTTP 200
- Batch proceeds (100 ≤ 100, NOT strictly less)
- All 100 phones attempted

**Edge factors:** Spec says `recipients.length > Number(process.env.WA_BULK_MAX ?? 100)` aborts. The `>` (not `>=`) makes `=100` allowable. A future implementer might typo `>=` and break this case.

**Test outline:**
```ts
it("accepts exactly WA_BULK_MAX recipients (100 allowed when MAX=100)", async () => {
  /* stub computeCoverage → 100 phones, assert HTTP 200 */
});
```

---

## #4 — [edge_case] missingFromGroup count = WA_BULK_MAX + 1

**Severity:** High
**Maps to gate:** G8

**Given:**
- WA_BULK_MAX=100
- `missingFromGroup.length === 101`

**When:**
- Admin POSTs bulk request

**Then:**
- HTTP 400 `exceeds_cap` with `{ count: 101, max: 100 }`
- `WaBatch` row created then immediately marked `status="aborted"` (audit trail of the attempt)
- NO Meta API call
- NO `WaBatchItem` rows

**Edge factors:** The audit row decision is non-trivial — alternative is "no row at all". Recommend abort-row for forensic visibility ("when did the operator try to bulk too many?").

**Test outline:**
```ts
it("rejects 101 recipients with 400 exceeds_cap and leaves an aborted WaBatch row", async () => {
  /* stub computeCoverage → 101 phones, assert HTTP 400 + WaBatch aborted */
});
```

---

## #5 — [edge_case] All 32 phones have a recent WaOutbound (every one is skipped)

**Severity:** Medium (operator confusion: "I clicked the button and nothing happened")
**Maps to gate:** spec's 30-day idempotency + UI feedback

**Given:**
- All 32 have a `WaOutbound { templateKey="grp_invite", sentAt = NOW − 15d }` row

**When:**
- Admin POSTs `{ force: false, dryRun: false }`

**Then:**
- HTTP 200
- Response: `{ total: 32, sent: 0, skipped: 32, failed: 0, details: [...{outcome:"skipped", reason:"recently_invited_15_days"}×32] }`
- `WaBatch.status="done"`, 32 WaBatchItem rows with `outcome="skipped"`
- NO Meta API calls (all skipped before send)
- NO new WaOutbound rows (skipped doesn't overwrite)
- 1 OOB notify with `"32 destinatários, 0 enviados"`

**Edge factors:** Operator might interpret 0 sent as a failure. UI must clearly distinguish skipped from failed.

**Test outline:**
```ts
it("skips all when every phone has lastInvite < 30d, no Meta calls fire", async () => { /* ... */ });
```

---

## #6 — [edge_case] Phone with lastInvite exactly 30 days ago (boundary, day-boundary inclusive)

**Severity:** High (off-by-one between business intent and the floor-division logic)
**Maps to gate:** 30-day idempotency

**Given:**
- One phone has `WaOutbound { sentAt = NOW − exactly 30 * 24 * 60 * 60 * 1000 ms }`
- All other preflight green

**When:**
- Admin POSTs bulk

**Then:**
- That phone is allowed (the helper uses `daysSince >= 30 → allowed`)
- New `WaOutbound` row replaces the old; new send fires

**Edge factors:** The helper code already has unit tests for this exact boundary, but the integration test should confirm end-to-end behaviour (delete-then-create succeeds with the unique constraint).

**Test outline:**
```ts
it("re-sends when last invite was exactly 30 days ago (boundary inclusive)", async () => { /* ... */ });
```

---

## #7 — [edge_case] Phone with lastInvite 29 days 23 hours 59 minutes ago

**Severity:** Medium (just barely-blocked)
**Maps to gate:** 30-day idempotency

**Given:**
- One phone has `WaOutbound { sentAt = NOW − (30d - 1min) }`

**When:**
- Admin POSTs bulk

**Then:**
- That phone is skipped with `reason: "recently_invited_29_days"` (floor)
- `daysSince = 29`, not 30

**Edge factors:** The `Math.floor` introduces a one-minute-late-and-you-wait-another-day quirk. Operators may try `force: true` to bypass. Confirmed by helper unit test, integration test asserts the **reason string** including the day count.

**Test outline:**
```ts
it("skips phone with daysSince=29 and surfaces 'recently_invited_29_days' reason", async () => { /* ... */ });
```

---

## #8 — [edge_case] force=true bypasses 30-day window

**Severity:** Medium
**Maps to gate:** 30-day idempotency override

**Given:**
- 32 phones all with `WaOutbound { sentAt = NOW − 10d }`

**When:**
- Admin POSTs `{ force: true, dryRun: false }`

**Then:**
- All 32 are re-sent
- Each `WaOutbound` row is overwritten (delete-then-create)
- All `WaEvent kind="GROUP_INVITE_SENT"` rows added

**Edge factors:** Operator decision tracked in `WaBatch.triggeredBy` or a new `force=true` audit row. Recommend adding a `WaEvent kind="BULK_FORCE_OVERRIDE"` at batch start with the operator session ID so this isn't invisible later.

**Test outline:**
```ts
it("force=true re-sends all phones regardless of 30-day window", async () => { /* ... */ });
```

---

## #9 — [edge_case] dryRun=true with all preflight green

**Severity:** Low (positive — validates the planning loop)
**Maps to gate:** dryRun branch

**Given:**
- Baseline preflight green
- 32 phones in missingFromGroup

**When:**
- Admin POSTs `{ force: false, dryRun: true }`

**Then:**
- HTTP 200
- Response: `{ total: 32, sent: 0, skipped: 0, failed: 0, dry: 32, details: [...{outcome:"dry"}×32] }`
- `WaBatch` row created, status="done", recipients=32 (the planning ran)
- 32 `WaBatchItem` rows with `outcome="dry"`
- **NO** `WaOutbound` rows (no real send)
- **NO** Meta API calls
- OOB notify message includes `"dry-run: true"`

**Edge factors:** Spec says dryRun creates a batch row to keep audit consistent. Alternative interpretation: dryRun = no batch row at all. Pick the explicit-audit path; document.

**Test outline:**
```ts
it("dryRun=true populates a batch with WaBatchItem rows but no WaOutbound or Meta calls", async () => { /* ... */ });
```

---

## #10 — [edge_case] dryRun=true on a preflight failure (G2 off)

**Severity:** Low
**Maps to gate:** G2 even with dryRun

**Given:**
- WA_OUTBOUND_ENABLED unset
- Otherwise baseline

**When:**
- Admin POSTs `{ dryRun: true }`

**Then:**
- HTTP 423 `outbound_disabled` (preflight ALWAYS runs, dryRun is no escape hatch)
- NO batch row
- NO WaBatchItem rows

**Edge factors:** Surprising for newcomer reading the code — "but I said dry-run". The preflight is on purpose: kill-switch must always hold. Document the precedence in the endpoint header comment.

**Test outline:**
```ts
it("dryRun does not bypass preflight gates (kill switch wins)", async () => { /* ... */ });
```

---

## #11 — [edge_case] phoneE164 in client body is rejected with `unexpected_recipient_field`

**Severity:** High (defence in depth — spec G7)
**Maps to gate:** G7

**Given:**
- A stale client (e.g. someone running PR #18's bundled JS) sends `{ phoneE164s: ["+351..."], force: false }`

**When:**
- That body hits the new endpoint

**Then:**
- HTTP 400 `unexpected_recipient_field`
- NO batch row, NO send

**Edge factors:** Body might also contain other unknown fields. The strict allow-list approach (only `force`, `dryRun`) is safer than blocking only `phoneE164s`. Test both.

**Test outline:**
```ts
it("rejects body with phoneE164s field even if other fields look right", async () => { /* ... */ });
it("rejects body with arbitrary unknown top-level keys", async () => { /* ... */ });
```

---

## #12 — [edge_case] All recipients have phoneE164 = null after recovery

**Severity:** Medium (data integrity)
**Maps to gate:** computeCoverage contract

**Given:**
- `computeCoverage()` returns `missingFromGroup = [{customerId: 1, displayName: "X", phoneE164: null, plan: "..."}]` (shouldn't happen — coverage normally routes phoneless to `subsWithoutPhone`, but defence-in-depth)

**When:**
- Endpoint loop hits the null phone

**Then:**
- Either:
  - (a) Filter null before counting against G8 cap; OR
  - (b) Count it but skip in loop with outcome `"failed"`, reason `"no_phone"`
- Recommend (a) — `recipients = missingFromGroup.filter(m => m.phoneE164 !== null)`

**Edge factors:** computeCoverage's invariant (phoneless go to `subsWithoutPhone`) might be violated by a future refactor. The endpoint should not trust it; test the defensive filter.

**Test outline:**
```ts
it("filters phoneless rows defensively before counting against G8 cap", async () => { /* ... */ });
```

---

## #13 — [edge_case] Subscriber displayName is "" (empty string)

**Severity:** Medium (template renders "Olá !" which is awkward)
**Maps to gate:** formatInviteParams fallback

**Given:**
- One subscriber's Yogo profile has no first/last name → `displayName = "#<customerId>"` or `""`

**When:**
- Loop builds template params

**Then:**
- `formatInviteParams` returns `[{ type:"text", text:"amigo" }, { type:"text", text:<url> }]`
- Recipient receives `"Olá amigo! 👊"`

**Edge factors:** The fallback to `"amigo"` already has a unit test. The integration test should assert the Meta template parameters include `"amigo"` and not `"#42"` or `""`.

**Test outline:**
```ts
it("uses 'amigo' fallback when displayName is empty/whitespace/#id", async () => { /* ... */ });
```

---

## #14 — [edge_case] Subscriber displayName is "李四" (CJK Unicode)

**Severity:** Low (encoding bug catch)
**Maps to gate:** template parameter encoding

**Given:**
- One subscriber's displayName is `"李四"`

**When:**
- Loop builds template params

**Then:**
- `formatInviteParams("李四", url)[0]` returns `{ type:"text", text:"李四" }` (regex `\s+` doesn't match CJK)
- Meta API receives UTF-8 bytes; template renders correctly in WhatsApp

**Edge factors:** A regression where the regex is changed to `/[a-zA-Z\s]+/` would silently drop CJK names. The unicode test guards against that.

**Test outline:**
```ts
it("preserves CJK unicode names in template parameters", async () => { /* ... */ });
```

---

## #15 — [error_path] G3 fails — WA_GROUP_INVITE_URL is unset

**Severity:** Critical
**Maps to gate:** G3

**Given:**
- WA_GROUP_INVITE_URL unset
- All other env present

**When:**
- Admin POSTs bulk

**Then:**
- HTTP 400 `bad_invite_url_shape`
- NO batch row
- NO send

**Edge factors:** The error code is 400 (operator config error, fixable) not 423 (kill switch). Distinguish in the UI banner: "Variável `WA_GROUP_INVITE_URL` em falta no Vercel" vs "Outbound desligado".

**Test outline:**
```ts
it("returns 400 bad_invite_url_shape when WA_GROUP_INVITE_URL is unset", async () => { /* ... */ });
```

---

## #16 — [error_path] G4 fails — URL has correct shape but wrong fingerprint

**Severity:** Critical (defence-in-depth catch when env is mis-set to a *different* invite link)
**Maps to gate:** G4

**Given:**
- WA_GROUP_INVITE_URL = `https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRST` (regex passes)
- INVITE_URL_FINGERPRINT_PROD = `"AbCdEf"` (doesn't match the URL above)

**When:**
- Admin POSTs bulk

**Then:**
- HTTP 423 `invite_url_fingerprint_mismatch`
- NO batch row

**Edge factors:** The fingerprint is hardcoded in `src/lib/wa/config.ts`. Rotating the group link requires a PR to update the constant. Without G4, a mis-set env in prod silently sends invites to a stranger's group.

**Test outline:**
```ts
it("returns 423 invite_url_fingerprint_mismatch when URL passes shape but not fingerprint", async () => { /* ... */ });
```

---

## #17 — [temporal] Fingerprint confirmed exactly 24h ago

**Severity:** Medium (boundary)
**Maps to gate:** G5

**Given:**
- WaSetting `fingerprint_confirmed_by_<sessionKey>` value = `(NOW − exactly 24h).toISOString()`

**When:**
- Admin POSTs bulk

**Then:**
- Boundary decision: spec says "must exist within 24h". Interpret as `confirmedAt ≥ NOW − 24h` (inclusive). Test BOTH `=24h - 1s` (allows) AND `=24h + 1s` (rejects with 412 `fingerprint_not_confirmed`).

**Edge factors:** Boundary off-by-one — implementer must use the same comparison in code and test. Document the inclusive/exclusive choice.

**Test outline:**
```ts
it("allows fingerprint confirmation aged just under 24h, rejects just over", async () => { /* ... */ });
```

---

## #18 — [concurrent] Two admins click Convidar todos within 1 second

**Severity:** Critical
**Maps to gate:** G11

**Given:**
- Two independent sessions (Ricardo + Marcelo), both admins, both with valid fingerprint confirmation
- No `WaBatch` row exists with `kind="invite"` `status="open"`

**When:**
- Both POST `{ force:false, dryRun:false }` within 1s

**Then:**
- One request acquires the lock via unique `(kind, status="open")` constraint on `WaBatch`
- The other receives a Prisma `P2002` unique violation → endpoint catches it → HTTP 409 `batch_in_flight`
- Only ONE batch ever runs

**Edge factors:** The race is real in serverless — Vercel may spin two function instances. The unique constraint MUST be enforced at the DB layer, not in code. Verify Prisma generates the correct migration.

**Test outline:**
```ts
it("returns 409 batch_in_flight on concurrent click, only one batch row exists", async () => {
  /* fire two parallel POSTs, assert exactly 1 WaBatch row */
});
```

---

## #19 — [concurrent] Admin clicks Pause mid-batch at iteration 7/32

**Severity:** High
**Maps to gate:** pause/resume contract

**Given:**
- Batch running, 7 phones processed, currently sleeping in the 5-min gap
- Admin clicks Pause → POST `/api/whatsapp/admin/group-invite/bulk/<batchId>/pause`

**When:**
- The endpoint sets `WaBatch.status="paused"`, `pausedAt=NOW`

**Then:**
- The bulk loop checks `WaBatch.status` at the next gap-end (or immediately if it's checking before each send)
- Sees "paused" → breaks the loop
- Final response (for the original POST): `{ total:32, sent:7, skipped:0, failed:0, aborted:false, details: [...7 items...] }`
  - **Open question:** what counts as `total`? Spec ambiguous between "attempted" (7) and "planned" (32). Recommend `total=attempted=7` for the response; the planned count lives in `WaBatch.recipients` for audit.

**Edge factors:** The "where in the loop" matters. If the loop sleeps then sends, a pause during sleep is honoured immediately. If the loop sends then sleeps, a pause is honoured after the next send. Document the placement.

**Test outline:**
```ts
it("honours pause between sends, total reflects attempted not planned", async () => { /* ... */ });
```

---

## #20 — [concurrent] Resume after pause picks up the remaining 25

**Severity:** High
**Maps to gate:** pause/resume contract

**Given:**
- Batch from #19 paused at 7/32
- WaBatchItem has 7 rows with outcome in {sent, skipped, failed} + 0 rows for the remaining 25 (we don't pre-populate "pending" rows)

**When:**
- Admin clicks Resume → POST `/api/whatsapp/admin/group-invite/bulk/<batchId>/resume`

**Then:**
- `WaBatch.status` reverts to `"open"` (or a new `"resumed"`?)
- A new sync loop iterates the REMAINING recipients = `computeCoverage().missingFromGroup` minus `WaBatchItem.phoneE164` already processed
- Sends 25 phones (or fewer if some are now covered — coverage might have changed during the pause)

**Edge factors:** **Major**: re-deriving recipients on resume means the cohort can drift. If someone joined the group during the pause, they should NOT be re-invited. Test this: phone 23 joins the group between pause and resume → coverage report excludes them → resume only sends 24.

**Test outline:**
```ts
it("resume re-derives recipients and excludes anyone who joined during the pause", async () => { /* ... */ });
```

---

## #21 — [integration] Meta returns 429 on phone 5, retry succeeds

**Severity:** Medium
**Maps to gate:** rate limit handling

**Given:**
- 32 phones, phone 5's `sendTemplate` returns `{ ok: false, status: 429 }`
- After 5s backoff, second call returns `{ ok: true, status: 200 }`

**When:**
- Loop reaches phone 5

**Then:**
- Single retry waits 5s (spec value)
- Retry succeeds → outcome `"sent"`
- Phone 5's `WaOutbound { status: "sent" }`
- Batch continues with phone 6

**Edge factors:** Persistent 429 (both attempts fail) falls through to `outcome: "failed", reason: "rate_limited"`. Test both branches.

**Test outline:**
```ts
it("retries once on 429, second-call success marks outcome sent", async () => { /* ... */ });
it("persistent 429 marks outcome failed with reason rate_limited", async () => { /* ... */ });
```

---

## #22 — [integration] Meta returns 401 mid-batch (token revoked)

**Severity:** Critical
**Maps to gate:** auth-fail abort

**Given:**
- 32 phones, phone 5's call returns `{ ok: false, status: 401, body: "OAuthException ..." }`

**When:**
- Loop reaches phone 5

**Then:**
- `isAuthFailure(401)` returns true → batch aborts
- `WaBatch.status="aborted"`
- Response: `{ total:5, sent:4, failed:1, aborted:true, details: [...5 items, last with reason:"wa_auth_fail"] }`
- `WaEvent kind="GROUP_INVITE_FAIL", meta={metaStatus:401, abort:true}` for phone 5
- OOB notify "Batch aborted — Meta auth failed at 5/32" if implemented

**Edge factors:** The abort must NOT leave the batch in a stuck `"open"` state — otherwise the next click gets 409 forever. Test that aborting releases the unique constraint (only `status="open"` is in the unique).

**Test outline:**
```ts
it("aborts batch on 401, sets aborted flag, releases concurrent-batch lock", async () => { /* ... */ });
```

---

## #23 — [integration] Meta template status preflight (G10) returns REJECTED

**Severity:** Critical
**Maps to gate:** G10

**Given:**
- `GET /v21.0/{WABA_ID}/message_templates?name=convite_grupo_whatsapp` returns `[{ status: "REJECTED" }]`
- The 15-min cache is cold

**When:**
- Admin POSTs bulk

**Then:**
- HTTP 503 `template_not_approved`
- NO batch row, NO send
- WaEvent `TEMPLATE_STATUS_REJECTED` logged

**Edge factors:** Status values from Meta: `PENDING`, `APPROVED`, `REJECTED`, `PAUSED`, `DISABLED`. Only `APPROVED` allows the batch. The cache TTL is 15 min — test that a `PENDING` from 16 min ago triggers a re-fetch.

**Test outline:**
```ts
it.each(["PENDING", "REJECTED", "PAUSED", "DISABLED"])(
  "blocks bulk with 503 template_not_approved when status is %s",
  async (status) => { /* ... */ },
);
it("uses cached APPROVED for 15 min before re-fetching", async () => { /* ... */ });
```

---

## #24 — [recovery] Network throw between waOutbound.deleteMany and sendTemplate

**Severity:** High (documented trade-off, but must be a TEST so we know it stays an accepted trade-off)
**Maps to gate:** spec's "delete-then-create without DB tx around the Meta call" decision

**Given:**
- Phone 5 has a `WaOutbound` row from 10 days ago
- After `deleteMany`, `sendTemplate` throws a network error

**When:**
- Loop reaches phone 5

**Then:**
- The throw bubbles to the outer try/catch in the endpoint
- HTTP 500 `bulk_failed`
- `WaBatch.status` left at "open" — operator can resume
- **Critical:** the deleted `WaOutbound` row is GONE. Next attempt at this phone sees no prior row → idempotency allows immediate re-send.
- Document in code AND test: this is acceptable because the 30-day window resets at zero, not in the past.

**Edge factors:** If the spec ever switches to "preserve the last attempt across crashes" semantics, this test will fail and force the implementer to introduce a proper DB transaction. That's a feature, not a bug.

**Test outline:**
```ts
it("crash mid-iteration leaves a delete-without-create gap that is acceptable per spec", async () => { /* ... */ });
```

---

## #25 — [state_transition] Two batches in sequence — second waits for first to finish

**Severity:** Medium
**Maps to gate:** G11 batch lifecycle

**Given:**
- Batch A is running (status="open")
- Admin attempts to start batch B

**When:**
- B is rejected with 409 (covered in #18)
- Batch A finishes (status="done")
- Admin retries → starts batch C

**Then:**
- C succeeds (unique constraint `(kind, status="open")` no longer blocks because A is now "done")
- C derives a fresh recipient list (the 32 from A may now be 0 if all joined the group)

**Edge factors:** **Trap:** if the unique constraint includes only `(kind, status)` and `status` is nullable, two `kind="invite", status=NULL` rows could coexist. Verify in the schema that `status` has a default of `"open"` and is non-null.

**Test outline:**
```ts
it("after batch A finishes (status=done), a new batch C can start", async () => { /* ... */ });
it("WaBatch.status default is 'open' and column is NOT NULL", async () => { /* schema test */ });
```
