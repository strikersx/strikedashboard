# Scenario summary — bulk send 32 missing subscribers

**Run:** 2026-05-27 12:30, 25 iterations, standard depth, focus=edge cases, format=test scenarios.

## Headline numbers

- **25 scenarios generated** — all new, zero duplicates flagged.
- **6 Critical, 7 High, 9 Medium, 4 Low** severity distribution.
- **8 of 12 dimensions covered** (67%): happy_path, edge_case, error_path, temporal, concurrent, integration, recovery, state_transition. **Not covered:** abuse_misuse, scale, data_variation (partial — only CJK), permission. *Permission was excluded by design — the admin-only gate is well-covered by the existing `getSession()` test in `tests/lib/wa/`.*
- **3 spec ambiguities surfaced** that warrant a written decision before PR-G implementation (see `edge-cases.md` → Recommendations).

## Composite metric

```
scenarios_generated      = 25 × 10  = 250
edge_cases_found         = 17 × 15  = 255      (the focus dimension)
dimensions_covered       = 8/12 × 30 = 20
unique_actors_explored   = 5 × 5    = 25       (admin, endpoint, computeCoverage, Meta, DB)
high_severity_found      = 13 × 3   = 39
                                    -------
                          total     = 589
```

## Severity heatmap by dimension

| Dimension | Crit | High | Med | Low | Total |
|---|---|---|---|---|---|
| edge_case | 0 | 4 | 6 | 2 | 12 |
| error_path | 2 | 0 | 0 | 0 | 2 |
| concurrent | 1 | 2 | 0 | 0 | 3 |
| integration | 2 | 0 | 1 | 0 | 3 |
| temporal | 0 | 0 | 1 | 0 | 1 |
| recovery | 0 | 1 | 0 | 0 | 1 |
| state_transition | 0 | 0 | 1 | 0 | 1 |
| happy_path | 0 | 0 | 0 | 1 | 1 |
| **Total** | **6** | **7** | **9** | **4** | **25** |

## Top 5 risks to address in PR-G

1. **(Crit #18)** Same operator double-clicks or opens two tabs within 1s — only `admin` role exists, so the race is same-session. Enforce concurrency with a DB-level unique on `WaBatch (kind, status="open")`. In-code check is too late.
2. **(Crit #22)** Meta returns 401 mid-batch — abort must transition `WaBatch.status` away from `"open"` so the unique releases. Otherwise next admin gets 409 forever.
3. **(Crit #23)** Meta template REJECTED — 503 with the specific error code. Cache TTL behaviour on PENDING needs a written decision.
4. **(Crit #15, #16)** Preflight URL gates — distinguish 400 (config error, operator can fix) from 423 (kill switch). UI needs both banners.
5. **(High #20)** Resume after pause must re-derive recipients — if someone joined during the pause they MUST be skipped. Test this with a synthetic "joined during pause" scenario.

## Spec ambiguities (decide before PR-G)

| # | Question | Recommended decision |
|---|---|---|
| 1 | Should preflight failures (`exceeds_cap`, `roster_stale`, etc.) create an aborted `WaBatch` row for audit? | Yes — write the row with `status="aborted"`. Cost is one extra row per attempt; benefit is forensic visibility. |
| 2 | What is `total` in the response when a batch is paused mid-flight? | `total = attempted` (matches `details.length`). Planned count lives in `WaBatch.recipients`. |
| 3 | What's the cache TTL behaviour for `G10` template status when result is non-APPROVED? | Same 15-min TTL for all non-APPROVED — don't keep slamming Meta. Operator must wait for the cache to expire or manually clear via a TBD endpoint. |

## What this exercise produced

- `overview.md` — what was tested and why.
- `scenarios.md` — full 25 situations in test-scenario format (Given/When/Then + test outline).
- `edge-cases.md` — same 25 cherry-picked by severity, with a Recommendations section.
- `scenario-results.tsv` — iteration log.

## Next actions

1. **Spec amendment** — answer the 3 ambiguities above. 30 min.
2. **PR-G plan** — bake the 12 Critical+High scenarios into the task list as integration tests. Use this folder as the source of test names.
3. **Optional:** run `/autoresearch:scenario` with `--focus failures` for a second pass focused on recovery / partial-failure modes; we covered them lightly here.
4. **Optional:** run `/autoresearch:security --scope src/app/api/whatsapp/**` to threat-model the new endpoint surface (G7 explicitly removes the client-supplied phone list, but a stale client + token leak still warrants audit).
