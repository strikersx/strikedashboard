# Judge Transcripts (Decoded)

Label map: X = Candidate B, Y = Candidate AB (synthesis), Z = Candidate A (initial brainstorm)

---

## Judge #1 — Backend reliability

**WINNER:** Y (= AB)
**RUNNER-UP:** X (= B)
**REASONING:** Y and X are near-identical in architectural substance. Y wins on two concrete operational hedges X omits: (a) "Template pending → TEMPLATE_PENDING log skip send" in S5 — meaning S5 ships even if Meta template review slips, decoupling deploy from Meta's queue; (b) explicit dispatch.ts separation from handlers and explicit `+@libsql/client, +vitest` package.json edit, making the Slice 1 Prisma 7 / libsql risk reviewable as a discrete diff. Z is disqualified on correctness — "Done = 1 aluno reserva, 1 cancela, 1 trial" is N=1 acceptance.
**WINNING_STRENGTH:** S5's TEMPLATE_PENDING log+skip behaviour — lets the cron ship and self-instrument before Meta approves the template.
**RUNNER_UP_GAP:** X submits the template at G3 but never specifies cron behaviour if approval slips past ship.

---

## Judge #2 — Pragmatic shipper

**WINNER:** Y (= AB)
**RUNNER-UP:** X (= B)
**REASONING:** Y adds three concrete shipping safeguards X lacks: a 15min cancel cutoff (prevents the "cancelled 2min before class" footgun on a Saturday night), an explicit `version` optimistic lock on WaSession (prevents racing webhooks from double-booking when Meta retries), and a Done-criteria that explicitly rejects single-shot demos and requires WaEvent observability over one week. Z is disqualified for pragmatic shipping: no kill switch slice, no DST handling for the 11h Lisbon cron, no raw-body handling, no state-machine version lock, "spike 3 alunos" is not a phone-normalization mitigation. Z's S2 collapsing reservar+cancelar into one slice means the most dangerous PR (the one that mutates Yogo) gets the least review surface.
**WINNING_STRENGTH:** 15min cancel cutoff + version optimistic lock + "single-shot demos do not count" Done-criteria — these are the three things that separate a v1 that survives a real Saturday from one that doesn't.
**RUNNER_UP_GAP:** X's Done-criteria allows the bookings/cancellations to happen in a tight window without explicit "over one week" + "single-shot demos do not count" — and X omits the 15min cancel cutoff and version optimistic lock.

---

## Judge #3 — Codebase reviewer

**WINNER:** Y (= AB)
**RUNNER-UP:** X (= B)
**REASONING:** Y and X are structurally identical, but Y demonstrates sharper codebase grounding by correctly citing dashboard/trials/page.tsx:103 with the "has signup populate" justification — Z cites :105, the inferior source. Y also strengthens the rollout contract with "Single-shot demos do not count" and flags the Prisma sqlite→turso flip as "mechanical but not silent" gating Slice 1 review. Z fails multiple hard criteria: bundles Turso migration with webhook (S1) and bundles reservar+cancelar (S2), under-specifies HMAC with no raw-body handling, omits DST entirely, has no kill switch/health, mitigates phone normalization with "spike 3 alunos" against ~700 customers.
**WINNING_STRENGTH:** Y's explicit "Single-shot demos do not count" done criterion combined with the correct trials/page.tsx:103 citation proves it actually read the codebase and pre-empted the N=1 anti-pattern.
**RUNNER_UP_GAP:** X cites the weaker source file and lacks Y's explicit anti-N=1 done-criterion clause and the "mechanical but not silent" Slice 1 review gate.
