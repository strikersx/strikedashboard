# WhatsApp Group Invite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Convidar todos` action plus a single-recipient test channel to `/dashboard/wa/coverage` that sends the Meta-approved `convite_grupo_whatsapp` template to subscribers in the **Faltam convidar** bucket, with a 30-day idempotency window and inline result feedback.

**Architecture:** A new POST endpoint `/api/whatsapp/admin/group-invite/bulk` sequentially iterates the provided phones, reads/writes `WaOutbound` keyed by `templateKey = "grp_invite"` to enforce idempotency, calls Meta's `sendTemplate`, and returns a per-phone summary. The coverage GET endpoint is extended to decorate each `missingFromGroup` entry with its latest invite state so the UI can render badges. UI changes live in the existing client page.

**Tech Stack:** Next.js 15 App Router (Node runtime), TypeScript, Prisma + Turso/SQLite, Vitest, Meta Cloud API v21.0 (existing `sendTemplate` helper in `src/lib/wa/meta.ts`), Tailwind-free inline styles (matching existing coverage page).

---

## Spec Reference

`docs/superpowers/specs/2026-05-27-wa-group-invite-design.md`

## File Map

| Action | Path | Responsibility |
|---|---|---|
| **Create** | `src/lib/wa/group-invite.ts` | Pure helpers: `idempotencyAllows`, `formatInviteParams`, `summarizeDetails`. No I/O. Unit-tested. |
| **Create** | `src/app/api/whatsapp/admin/group-invite/bulk/route.ts` | The POST endpoint. Auth → validate → name resolution → iterate → respond. |
| **Modify** | `src/lib/wa/group-coverage.ts` | Add `lastInvite` decoration on `missingFromGroup` entries by joining `WaOutbound` rows where `templateKey = "grp_invite"`. |
| **Modify** | `src/app/dashboard/wa/coverage/page.tsx` | Add bulk button, test send input, per-row badges, summary toast. |
| **Modify** | `.env.example` | Document `WA_GROUP_INVITE_URL`. |
| **Create** | `tests/lib/wa/group-invite.test.ts` | Vitest unit suite for the pure helpers. |

Endpoint, page, and the modified `group-coverage.ts` are NOT unit-tested (the codebase explicitly excludes I/O modules like `meta.ts`, `auth.ts`, `db.ts`, `dispatch.ts` from coverage — see `vitest.config.ts`). They are verified manually via `dryRun` and the test input on the page.

---

## Task 1 — Pure helpers: `idempotencyAllows`

**Files:**
- Create: `src/lib/wa/group-invite.ts`
- Create: `tests/lib/wa/group-invite.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/wa/group-invite.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { idempotencyAllows } from "../../../src/lib/wa/group-invite";

describe("idempotencyAllows", () => {
  const now = new Date("2026-05-27T10:00:00.000Z");

  it("allows when no prior send", () => {
    expect(idempotencyAllows(now, null, false)).toEqual({ allowed: true });
  });

  it("blocks when last send was 3 days ago", () => {
    const lastSentAt = new Date("2026-05-24T10:00:00.000Z");
    expect(idempotencyAllows(now, lastSentAt, false)).toEqual({
      allowed: false,
      daysSince: 3,
    });
  });

  it("blocks when last send was 29 days ago (still inside window)", () => {
    const lastSentAt = new Date("2026-04-28T10:00:00.000Z");
    expect(idempotencyAllows(now, lastSentAt, false)).toEqual({
      allowed: false,
      daysSince: 29,
    });
  });

  it("allows when last send was 31 days ago", () => {
    const lastSentAt = new Date("2026-04-26T10:00:00.000Z");
    expect(idempotencyAllows(now, lastSentAt, false)).toEqual({ allowed: true });
  });

  it("allows when force=true regardless of recency", () => {
    const lastSentAt = new Date("2026-05-26T10:00:00.000Z");
    expect(idempotencyAllows(now, lastSentAt, true)).toEqual({ allowed: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/wa/group-invite.test.ts`
Expected: FAIL — module `src/lib/wa/group-invite` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/wa/group-invite.ts`:

```typescript
// Pure helpers shared by /api/whatsapp/admin/group-invite/bulk and tests.
// Keep this file I/O-free so it stays in the vitest coverage allow-list.

const INVITE_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type IdempotencyDecision =
  | { allowed: true }
  | { allowed: false; daysSince: number };

export function idempotencyAllows(
  now: Date,
  lastSentAt: Date | null,
  force: boolean,
): IdempotencyDecision {
  if (force || lastSentAt === null) return { allowed: true };
  const daysSince = Math.floor((now.getTime() - lastSentAt.getTime()) / MS_PER_DAY);
  if (daysSince >= INVITE_WINDOW_DAYS) return { allowed: true };
  return { allowed: false, daysSince };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/wa/group-invite.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wa/group-invite.ts tests/lib/wa/group-invite.test.ts
git commit -m "feat(wa-invite): add idempotencyAllows helper"
```

---

## Task 2 — Pure helpers: `formatInviteParams` and `summarizeDetails`

**Files:**
- Modify: `src/lib/wa/group-invite.ts`
- Modify: `tests/lib/wa/group-invite.test.ts`

- [ ] **Step 1: Extend the failing test**

Append to `tests/lib/wa/group-invite.test.ts`:

```typescript
import {
  formatInviteParams,
  summarizeDetails,
  type SendDetail,
} from "../../../src/lib/wa/group-invite";

describe("formatInviteParams", () => {
  it("returns first-name + url as Meta template body parameters", () => {
    expect(formatInviteParams("João", "https://chat.whatsapp.com/ABC")).toEqual([
      { type: "text", text: "João" },
      { type: "text", text: "https://chat.whatsapp.com/ABC" },
    ]);
  });

  it("uses the fallback name when name is empty/whitespace", () => {
    expect(formatInviteParams("   ", "https://example.com")[0]).toEqual({
      type: "text",
      text: "amigo",
    });
  });

  it("trims a multi-word name to the first token", () => {
    expect(formatInviteParams("Maria João Silva", "https://example.com")[0]).toEqual({
      type: "text",
      text: "Maria",
    });
  });
});

describe("summarizeDetails", () => {
  it("counts outcomes correctly", () => {
    const details: SendDetail[] = [
      { phoneE164: "+351911111111", outcome: "sent" },
      { phoneE164: "+351922222222", outcome: "sent" },
      { phoneE164: "+351933333333", outcome: "skipped", reason: "recently_invited_5_days" },
      { phoneE164: "+351944444444", outcome: "failed", reason: "wa_auth_fail" },
      { phoneE164: "+351955555555", outcome: "dry" },
    ];
    expect(summarizeDetails(details)).toEqual({
      total: 5,
      sent: 2,
      skipped: 1,
      failed: 1,
      dry: 1,
    });
  });

  it("returns zeros for empty input", () => {
    expect(summarizeDetails([])).toEqual({
      total: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      dry: 0,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/wa/group-invite.test.ts`
Expected: FAIL — `formatInviteParams` and `summarizeDetails` not exported.

- [ ] **Step 3: Extend the implementation**

Append to `src/lib/wa/group-invite.ts`:

```typescript
export interface TemplateParameter {
  type: "text";
  text: string;
}

export type SendOutcome = "sent" | "skipped" | "failed" | "dry";

export interface SendDetail {
  phoneE164: string;
  outcome: SendOutcome;
  reason?: string;
  metaStatus?: number;
  metaError?: string;
}

export interface SendSummary {
  total: number;
  sent: number;
  skipped: number;
  failed: number;
  dry: number;
}

const FALLBACK_NAME = "amigo";

// Meta templates only accept text body params. We trim to the first token so
// "Maria João Silva" renders as "Olá Maria!" — friendlier and avoids name
// punctuation surprises.
export function formatInviteParams(
  displayName: string,
  inviteUrl: string,
): TemplateParameter[] {
  const firstToken = (displayName ?? "").trim().split(/\s+/)[0] ?? "";
  const name = firstToken.length > 0 ? firstToken : FALLBACK_NAME;
  return [
    { type: "text", text: name },
    { type: "text", text: inviteUrl },
  ];
}

export function summarizeDetails(details: SendDetail[]): SendSummary {
  const summary: SendSummary = { total: details.length, sent: 0, skipped: 0, failed: 0, dry: 0 };
  for (const d of details) {
    if (d.outcome === "sent") summary.sent++;
    else if (d.outcome === "skipped") summary.skipped++;
    else if (d.outcome === "failed") summary.failed++;
    else summary.dry++;
  }
  return summary;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/wa/group-invite.test.ts`
Expected: PASS, 10 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wa/group-invite.ts tests/lib/wa/group-invite.test.ts
git commit -m "feat(wa-invite): add formatInviteParams and summarizeDetails helpers"
```

---

## Task 3 — Extend coverage report with `lastInvite`

**Files:**
- Modify: `src/lib/wa/group-coverage.ts`

The spec requires per-row badges in the UI showing the latest invite state. Decorate each `missingFromGroup` entry with its latest `WaOutbound` row for `templateKey = "grp_invite"`.

- [ ] **Step 1: Add the `LastInvite` type and extend `CoverageSub`**

Modify `src/lib/wa/group-coverage.ts`. Add a new exported interface near the top of the existing interfaces:

```typescript
export interface LastInvite {
  sentAt: string;        // ISO 8601
  status: string;        // "sent" | "failed" | "pending"
  error: string | null;
}
```

- [ ] **Step 2: Make `missingFromGroup` rows carry an optional `lastInvite`**

Change the `CoverageReport.missingFromGroup` type from `CoverageSub[]` to the decorated variant:

Replace the existing line in the `CoverageReport` interface:

```typescript
  missingFromGroup: CoverageSub[];
```

with:

```typescript
  missingFromGroup: Array<CoverageSub & { lastInvite: LastInvite | null }>;
```

- [ ] **Step 3: Fetch the invite rows and join them in `computeCoverage`**

Locate the `Promise.all` at the top of `computeCoverage`:

```typescript
  const [activeSubs, allCustomers, members] = await Promise.all([
    fetchActiveRecurringSubs(),
    fetchAllYogoCustomers(),
    db.waGroupMember.findMany(),
  ]);
```

Replace with:

```typescript
  const [activeSubs, allCustomers, members, inviteRows] = await Promise.all([
    fetchActiveRecurringSubs(),
    fetchAllYogoCustomers(),
    db.waGroupMember.findMany(),
    db.waOutbound.findMany({
      where: { templateKey: "grp_invite" },
      select: { phoneE164: true, status: true, error: true, sentAt: true },
    }),
  ]);

  const inviteByKey = new Map<string, LastInvite>();
  for (const r of inviteRows) {
    const li: LastInvite = {
      sentAt: r.sentAt.toISOString(),
      status: r.status,
      error: r.error ?? null,
    };
    for (const k of keysFor(r.phoneE164)) inviteByKey.set(k, li);
  }
```

- [ ] **Step 4: Decorate `missingFromGroup` rows in the loop**

Locate the existing build of `missingFromGroup`:

```typescript
  const missingFromGroup: CoverageSub[] = [];
  const subsWithoutPhone: CoverageSub[] = [];
  for (const s of activeSubs) {
    const cs = toCoverageSub(s);
    if (!cs.phoneE164) { subsWithoutPhone.push(cs); continue; }
    const hit = lookup(memberByKey, keysFor(cs.phoneE164));
    if (!hit) missingFromGroup.push(cs);
  }
```

Replace with:

```typescript
  const missingFromGroup: Array<CoverageSub & { lastInvite: LastInvite | null }> = [];
  const subsWithoutPhone: CoverageSub[] = [];
  for (const s of activeSubs) {
    const cs = toCoverageSub(s);
    if (!cs.phoneE164) { subsWithoutPhone.push(cs); continue; }
    const hit = lookup(memberByKey, keysFor(cs.phoneE164));
    if (!hit) {
      const lastInvite = lookup(inviteByKey, keysFor(cs.phoneE164)) ?? null;
      missingFromGroup.push({ ...cs, lastInvite });
    }
  }
```

- [ ] **Step 5: Manually verify**

Run: `npm run dev` in one terminal, then in another:

```bash
curl -s -b "striker_session=admin" http://localhost:3000/api/whatsapp/admin/group-coverage \
  | node -e 'let s=""; process.stdin.on("data",c=>s+=c).on("end",()=>{const j=JSON.parse(s); console.log("missingFromGroup count:", j.missingFromGroup.length); console.log("first entry keys:", j.missingFromGroup[0] ? Object.keys(j.missingFromGroup[0]) : "none"); console.log("first lastInvite:", j.missingFromGroup[0]?.lastInvite);})'
```

Expected: `missingFromGroup count: 32` (or current), `first entry keys` contains `lastInvite`, value is `null` for fresh DB.

Stop the dev server with `Ctrl+C`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/wa/group-coverage.ts
git commit -m "feat(wa-coverage): decorate missingFromGroup with lastInvite state"
```

---

## Task 4 — Bulk endpoint skeleton with `dryRun`

**Files:**
- Create: `src/app/api/whatsapp/admin/group-invite/bulk/route.ts`

This task ships the endpoint with the `dryRun` branch only. The Meta send is added in Task 5 so we can validate the planning loop end-to-end before talking to Meta.

- [ ] **Step 1: Create the file**

Create `src/app/api/whatsapp/admin/group-invite/bulk/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalize } from "@/lib/phone";
import { fetchAllYogoCustomers } from "@/lib/yogo/recurring-subs";
import {
  idempotencyAllows,
  summarizeDetails,
  type SendDetail,
} from "@/lib/wa/group-invite";

const TEMPLATE_KEY = "grp_invite";

interface BulkRequest {
  phoneE164s: unknown;
  force?: unknown;
  dryRun?: unknown;
}

// POST /api/whatsapp/admin/group-invite/bulk
// Admin-only. Sends the Meta-approved template "convite_grupo_whatsapp" to the
// supplied phones. Skips anyone invited in the last 30 days unless force=true.
// dryRun=true plans the loop without writing rows or calling Meta.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const role = await getSession();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as BulkRequest | null;
  if (!body || !Array.isArray(body.phoneE164s) || body.phoneE164s.length === 0) {
    return NextResponse.json({ error: "phoneE164s_required" }, { status: 400 });
  }

  const phones: string[] = [];
  for (const p of body.phoneE164s) {
    if (typeof p !== "string") {
      return NextResponse.json({ error: "phoneE164s_must_be_strings" }, { status: 400 });
    }
    const n = normalize(p);
    if (!n.e164) {
      return NextResponse.json({ error: "invalid_phone", phone: p }, { status: 400 });
    }
    phones.push(n.e164);
  }

  const force = body.force === true;
  const dryRun = body.dryRun === true;
  const inviteUrl = process.env.WA_GROUP_INVITE_URL;
  if (!inviteUrl) {
    return NextResponse.json({ error: "missing_invite_url" }, { status: 500 });
  }

  // One Yogo round-trip up front, then a phone→name lookup against every
  // variant the normalizer produces.
  const customers = await fetchAllYogoCustomers();
  const nameByKey = new Map<string, string>();
  for (const c of customers) {
    if (!c.phoneE164) continue;
    for (const k of normalize(c.phoneE164).variants) {
      if (!nameByKey.has(k)) nameByKey.set(k, c.displayName);
    }
  }

  const now = new Date();
  const details: SendDetail[] = [];

  for (const phoneE164 of phones) {
    const name = lookupName(nameByKey, phoneE164) ?? "amigo";

    const prior = await db.waOutbound.findFirst({
      where: { phoneE164, templateKey: TEMPLATE_KEY },
      select: { sentAt: true },
    });

    const decision = idempotencyAllows(now, prior?.sentAt ?? null, force);
    if (!decision.allowed) {
      details.push({
        phoneE164,
        outcome: "skipped",
        reason: `recently_invited_${decision.daysSince}_days`,
      });
      continue;
    }

    if (dryRun) {
      details.push({ phoneE164, outcome: "dry", reason: `would_send_to_${name}` });
      continue;
    }

    // Real send lands in Task 5.
    details.push({ phoneE164, outcome: "failed", reason: "send_not_implemented" });
  }

  return NextResponse.json({ ...summarizeDetails(details), details });
}

function lookupName(map: Map<string, string>, phoneE164: string): string | null {
  for (const k of normalize(phoneE164).variants) {
    const v = map.get(k);
    if (v) return v;
  }
  return null;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify dryRun**

Start dev: `npm run dev` (in a separate terminal so this terminal stays free).

Get the list of missing phones from the coverage endpoint, then dry-run against the first 3:

```bash
curl -s -b "striker_session=admin" http://localhost:3000/api/whatsapp/admin/group-coverage \
  | node -e 'let s=""; process.stdin.on("data",c=>s+=c).on("end",()=>{const j=JSON.parse(s); const phones=j.missingFromGroup.slice(0,3).map(m=>m.phoneE164).filter(Boolean); console.log(JSON.stringify({phoneE164s:phones,dryRun:true}));})' \
  > /tmp/invite-dry.json

curl -s -X POST -H "Content-Type: application/json" -b "striker_session=admin" \
  --data @/tmp/invite-dry.json \
  http://localhost:3000/api/whatsapp/admin/group-invite/bulk
```

Expected: JSON with `total: 3`, `dry: 3`, three `details` entries each with `outcome: "dry"` and `reason: "would_send_to_<Name>"`.

Verify auth gate:

```bash
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"phoneE164s":["+351912000000"],"dryRun":true}' \
  http://localhost:3000/api/whatsapp/admin/group-invite/bulk
```

Expected: `{"error":"forbidden"}` with HTTP 403.

Verify invalid phone:

```bash
curl -s -X POST -H "Content-Type: application/json" -b "striker_session=admin" \
  --data '{"phoneE164s":["not-a-phone"]}' \
  http://localhost:3000/api/whatsapp/admin/group-invite/bulk
```

Expected: `{"error":"invalid_phone","phone":"not-a-phone"}` with HTTP 400.

Verify missing env (temporarily): comment out `WA_GROUP_INVITE_URL` in `.env.local`, restart `npm run dev`, repeat the first curl. Expected: HTTP 500 `{"error":"missing_invite_url"}`. Restore the env var afterwards.

Stop the dev server with `Ctrl+C`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/whatsapp/admin/group-invite/bulk/route.ts
git commit -m "feat(wa-invite): add bulk endpoint with dryRun branch"
```

---

## Task 5 — Real Meta send + persistence

**Files:**
- Modify: `src/app/api/whatsapp/admin/group-invite/bulk/route.ts`

- [ ] **Step 1: Add imports for the Meta client and the formatter**

In `src/app/api/whatsapp/admin/group-invite/bulk/route.ts`, add to the imports block:

```typescript
import { sendTemplate } from "@/lib/wa/meta";
import { formatInviteParams } from "@/lib/wa/group-invite";
```

(Note: `formatInviteParams` is added to the existing destructured import from `@/lib/wa/group-invite` rather than a second import line — adjust accordingly.)

Add a constant near the existing `TEMPLATE_KEY`:

```typescript
const TEMPLATE_NAME = "convite_grupo_whatsapp";
const LANGUAGE_CODE = "pt_PT";
const PER_REQUEST_GAP_MS = 200;
```

- [ ] **Step 2: Replace the placeholder `outcome: "failed", reason: "send_not_implemented"` branch**

Inside the for-loop, replace the `// Real send lands in Task 5.` placeholder and the line below it with the full send-and-persist block:

```typescript
    // Ensure the contact row exists so WaOutbound's FK is satisfied.
    await db.waContact.upsert({
      where: { phoneE164 },
      create: { phoneE164 },
      update: {},
    });

    // The @@unique([phoneE164, templateKey]) keeps the most recent attempt
    // only. Delete-then-create gives us atomic-enough overwrite semantics
    // without needing a transaction across the Meta call.
    await db.waOutbound.deleteMany({
      where: { phoneE164, templateKey: TEMPLATE_KEY },
    });

    const params = formatInviteParams(name, inviteUrl);
    const result = await sendWithRetry(phoneE164, params);

    if (result.ok) {
      await db.waOutbound.create({
        data: {
          phoneE164,
          kind: "template",
          payload: JSON.stringify({ template: TEMPLATE_NAME, name, url: inviteUrl }),
          status: "sent",
          templateKey: TEMPLATE_KEY,
        },
      });
      await db.waEvent.create({ data: { kind: "GROUP_INVITE_SENT", phoneE164 } });
      details.push({ phoneE164, outcome: "sent" });
    } else if (isAuthFailure(result.status)) {
      // Abort: don't burn through the cohort with bad credentials.
      await db.waOutbound.create({
        data: {
          phoneE164,
          kind: "template",
          payload: JSON.stringify({ template: TEMPLATE_NAME, name, url: inviteUrl }),
          status: "failed",
          templateKey: TEMPLATE_KEY,
          error: snippet(result.body),
        },
      });
      await db.waEvent.create({
        data: {
          kind: "GROUP_INVITE_FAIL",
          phoneE164,
          meta: JSON.stringify({ metaStatus: result.status, abort: true }),
        },
      });
      details.push({
        phoneE164,
        outcome: "failed",
        reason: "wa_auth_fail",
        metaStatus: result.status,
        metaError: snippet(result.body),
      });
      break;
    } else {
      const looksPending = isTemplatePendingError(result.body);
      const status = looksPending ? "pending" : "failed";
      const reason = looksPending
        ? "template_pending"
        : result.status === 429
          ? "rate_limited"
          : isInvalidRecipient(result.body)
            ? "invalid_recipient"
            : "meta_error";

      await db.waOutbound.create({
        data: {
          phoneE164,
          kind: "template",
          payload: JSON.stringify({ template: TEMPLATE_NAME, name, url: inviteUrl }),
          status,
          templateKey: TEMPLATE_KEY,
          error: snippet(result.body),
        },
      });
      await db.waEvent.create({
        data: {
          kind: looksPending ? "TEMPLATE_PENDING" : "GROUP_INVITE_FAIL",
          phoneE164,
          meta: JSON.stringify({ metaStatus: result.status }),
        },
      });
      details.push({
        phoneE164,
        outcome: "failed",
        reason,
        metaStatus: result.status,
        metaError: snippet(result.body),
      });
    }

    await sleep(PER_REQUEST_GAP_MS);
```

- [ ] **Step 3: Add the helpers at the bottom of the file**

Append below the existing `lookupName` function:

```typescript
async function sendWithRetry(
  phoneE164: string,
  params: ReturnType<typeof formatInviteParams>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const first = await sendTemplate(phoneE164, TEMPLATE_NAME, LANGUAGE_CODE, params);
  if (first.status !== 429) return first;
  await sleep(1000);
  return sendTemplate(phoneE164, TEMPLATE_NAME, LANGUAGE_CODE, params);
}

function isAuthFailure(status: number): boolean {
  return status === 401 || status === 403;
}

// Meta returns 400 with a 132xxx code when a template is unknown or pending.
function isTemplatePendingError(body: string): boolean {
  return /template|not.{0,10}translated|not.{0,10}approved|132\d{3}/i.test(body);
}

// 131026 = "Message Undeliverable" (recipient not on WhatsApp).
function isInvalidRecipient(body: string): boolean {
  return /131026|invalid.{0,10}recipient|not.{0,10}a.{0,10}whatsapp/i.test(body);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snippet(s: string): string {
  return s.length <= 200 ? s : s.slice(0, 200);
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verify — test send to Ricardo's phone**

Start dev: `npm run dev`. Ricardo's phone is `+351912873698`.

```bash
curl -s -X POST -H "Content-Type: application/json" -b "striker_session=admin" \
  --data '{"phoneE164s":["+351912873698"]}' \
  http://localhost:3000/api/whatsapp/admin/group-invite/bulk
```

Expected outcomes by environment state:

- **Template approved + valid number on WhatsApp:** `{"total":1,"sent":1,"skipped":0,"failed":0,"dry":0,"details":[{"phoneE164":"+351912873698","outcome":"sent"}]}` and the message arrives in Ricardo's WhatsApp inbox.
- **Template not yet approved:** `outcome: "failed"`, `reason: "template_pending"`, `metaStatus: 400`. A `TEMPLATE_PENDING` row appears in `WaEvent`.
- **No `WA_ACCESS_TOKEN`:** the endpoint will throw on `sendTemplate`. Expected: HTTP 500 surfaced by Next. Fix the env and retry.

Verify the DB row:

```bash
npx prisma studio  # browse to WaOutbound, find phoneE164=+351912873698, templateKey="grp_invite"
```

Expected: one row with `status: "sent"` (or `pending`/`failed` matching the outcome) and recent `sentAt`.

Verify idempotency by re-running the same curl:

Expected: `{"sent":0,"skipped":1,...,"details":[{...,"outcome":"skipped","reason":"recently_invited_0_days"}]}`.

Force-resend:

```bash
curl -s -X POST -H "Content-Type: application/json" -b "striker_session=admin" \
  --data '{"phoneE164s":["+351912873698"],"force":true}' \
  http://localhost:3000/api/whatsapp/admin/group-invite/bulk
```

Expected: `outcome: "sent"` again; the `WaOutbound` row is overwritten (one row remains, newer `sentAt`).

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/whatsapp/admin/group-invite/bulk/route.ts
git commit -m "feat(wa-invite): wire Meta send, idempotent persistence, abort on auth fail"
```

---

## Task 6 — UI: bulk button, test input, badges, toast

**Files:**
- Modify: `src/app/dashboard/wa/coverage/page.tsx`

- [ ] **Step 1: Extend the `Sub` interface and the `Report` shape**

In `src/app/dashboard/wa/coverage/page.tsx`, locate the `Sub` interface (around lines 13-19). It currently has no `lastInvite`. Replace with a separate variant for missing rows. Add a new interface above `Report`:

```typescript
interface LastInvite {
  sentAt: string;
  status: string;
  error: string | null;
}

interface MissingSub extends Sub {
  lastInvite: LastInvite | null;
}
```

Update the `Report` interface's `missingFromGroup` field:

```typescript
  missingFromGroup: MissingSub[];
```

- [ ] **Step 2: Add bulk-send state**

Inside `CoveragePage`, after the existing `useState` declarations (the ones for `csv`, `importBusy`, etc.), add:

```typescript
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    total: number; sent: number; skipped: number; failed: number; dry: number;
    details: Array<{ phoneE164: string; outcome: string; reason?: string; metaError?: string }>;
  } | null>(null);
  const [bulkErr, setBulkErr] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{
    outcome: string; reason?: string; metaError?: string;
  } | null>(null);
```

- [ ] **Step 3: Add the bulk-send callback**

After the existing `runImport` callback, add:

```typescript
  const runBulk = useCallback(async () => {
    if (!report || bulkBusy) return;
    const phones = report.missingFromGroup.map((m) => m.phoneE164).filter((p): p is string => !!p);
    if (phones.length === 0) return;

    const force = window.confirm(
      `Enviar template a ${phones.length} pessoas? Quem foi convidado nos últimos 30d será saltado.\n\nOK para enviar (saltando recentes). Cancelar para abortar.\n\nPara forçar reenvio mesmo dos recentes, marca a caixa "Forçar" no UI (em breve).`,
    );
    if (!force) return;

    setBulkBusy(true);
    setBulkErr(null);
    setBulkResult(null);
    try {
      const res = await fetch("/api/whatsapp/admin/group-invite/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneE164s: phones, force: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setBulkResult(data);
      await resync();
    } catch (e: unknown) {
      setBulkErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  }, [report, bulkBusy, resync]);

  const runTest = useCallback(async () => {
    if (testBusy || !testPhone.trim()) return;
    setTestBusy(true);
    setTestResult(null);
    setBulkErr(null);
    try {
      const res = await fetch("/api/whatsapp/admin/group-invite/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneE164s: [testPhone.trim()], force: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ outcome: "failed", reason: data.error || `HTTP ${res.status}` });
        return;
      }
      const detail = data.details?.[0];
      setTestResult({
        outcome: detail?.outcome ?? "unknown",
        reason: detail?.reason,
        metaError: detail?.metaError,
      });
      await resync();
    } catch (e: unknown) {
      setTestResult({ outcome: "failed", reason: e instanceof Error ? e.message : String(e) });
    } finally {
      setTestBusy(false);
    }
  }, [testBusy, testPhone, resync]);
```

- [ ] **Step 4: Render the bulk + test controls in the "Faltam convidar" section header**

Locate the `<Section title={\`Faltam convidar (${report.missingFromGroup.length})\`} ...>` block. Replace the entire `<Section ...>...</Section>` with:

```tsx
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <h3 className="head" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: report.missingFromGroup.length > 0 ? "#fbbf24" : "#fff", margin: 0 }}>
                Faltam convidar ({report.missingFromGroup.length})
              </h3>
              {report.missingFromGroup.length > 0 && (
                <button onClick={runBulk} disabled={bulkBusy} style={btnStyle("primary", bulkBusy)}>
                  {bulkBusy ? "A enviar..." : "Convidar todos"}
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>🧪 Testar:</span>
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+351912873698"
                style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, background: "#000", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", width: 200, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              />
              <button onClick={runTest} disabled={testBusy || !testPhone.trim()} style={btnStyle("ghost")}>
                {testBusy ? "..." : "Enviar teste"}
              </button>
              {testResult && (
                <span style={{ fontSize: 12, color: testResult.outcome === "sent" ? "#00E5A0" : testResult.outcome === "skipped" ? "#fbbf24" : "#fca5a5" }}>
                  {testResult.outcome}{testResult.reason ? ` · ${testResult.reason}` : ""}{testResult.metaError ? ` · ${testResult.metaError}` : ""}
                </span>
              )}
            </div>

            {bulkResult && (
              <div style={{ padding: 10, borderRadius: 8, background: "rgba(0,229,160,0.08)", color: "#bbf7d0", fontSize: 12, marginBottom: 10 }}>
                ✓ {bulkResult.sent} enviados · {bulkResult.skipped} saltados · {bulkResult.failed} falharam
              </div>
            )}
            {bulkErr && (
              <div style={errBox}>{bulkErr}</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {report.missingFromGroup.length === 0 ? (
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Todos os subscritores activos já estão no grupo 🎉</span>
              ) : (
                report.missingFromGroup.map((s) => (
                  <MissingSubRow key={s.customerId} sub={s} />
                ))
              )}
            </div>
          </section>
```

- [ ] **Step 5: Add the `MissingSubRow` component**

Add this function alongside the existing `SubRow`, `ExClientRow`, `MemberRow`:

```tsx
function MissingSubRow({ sub }: { sub: MissingSub }) {
  return (
    <div style={rowStyle}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", minWidth: 0, flex: 1, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{sub.displayName}</span>
        {sub.plan && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{sub.plan}</span>}
        <span className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{sub.phoneE164 ?? sub.phoneRaw ?? "—"}</span>
        {sub.lastInvite && <InviteBadge invite={sub.lastInvite} />}
      </div>
    </div>
  );
}

function InviteBadge({ invite }: { invite: LastInvite }) {
  const days = Math.floor((Date.now() - new Date(invite.sentAt).getTime()) / 86400000);
  const label = invite.status === "sent" ? `enviado ${days}d` : invite.status === "pending" ? "pendente" : "falhou";
  const color = invite.status === "sent" ? "rgba(0,229,160,0.85)" : invite.status === "pending" ? "#fbbf24" : "#fca5a5";
  return (
    <span title={`${new Date(invite.sentAt).toLocaleString("pt-PT")}${invite.error ? ` · ${invite.error}` : ""}`} style={{ fontSize: 11, color }}>
      · {label}
    </span>
  );
}
```

- [ ] **Step 6: Type-check and visual smoke test**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev`. Open `http://localhost:3000/dashboard/wa/coverage`. Log in as admin if needed.

Visually verify:
- **Faltam convidar** header shows `[Convidar todos]` button (only when count > 0).
- **🧪 Testar:** input + button render in the section.
- Typing `+351912873698` and clicking `Enviar teste` either sends (toast `sent`) or shows the failure reason inline.
- After a test send, the matching row in the list shows a badge `· enviado 0d` (hover for the date tooltip).
- Clicking **Convidar todos** opens a confirmation dialog. Cancel — nothing changes. OK — bulk runs, summary toast appears, list refreshes with badges.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/wa/coverage/page.tsx
git commit -m "feat(wa-coverage): add Convidar todos + test send + invite badges"
```

---

## Task 7 — Env documentation

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add `WA_GROUP_INVITE_URL` to `.env.example`**

Open `.env.example`. Find the WhatsApp section (look for `WA_ACCESS_TOKEN` or `WA_PHONE_NUMBER_ID`). Append a line:

```
# WhatsApp group invite link, regenerated from the WhatsApp app's
# "Invite via link → Copy" option. Used by /api/whatsapp/admin/group-invite/bulk.
WA_GROUP_INVITE_URL=
```

- [ ] **Step 2: Add the same to `.env.local`** (don't commit — `.env.local` is gitignored)

Edit your local `.env.local` and paste the current group invite link there. Save.

- [ ] **Step 3: Commit only the example**

```bash
git add .env.example
git commit -m "docs(env): document WA_GROUP_INVITE_URL"
```

---

## Task 8 — Production rollout checklist (no code; record run-through)

**Files:** none — this task is a checklist to follow during the actual rollout.

- [ ] **Step 1: Meta template submission**

Ricardo logs into Meta Business Manager → WhatsApp Manager → Message Templates → Create Template. Fill:
- Name: `convite_grupo_whatsapp`
- Category: MARKETING
- Language: Portuguese (Portugal) `pt_PT`
- Body (paste exactly):

```
Olá {{1}}! 👊

Tens a tua subscrição activa na Striker's House e ainda não estás no nosso grupo de WhatsApp.

Lá partilhamos horários, novidades da academia e fotos das aulas.

Junta-te aqui: {{2}}

Não vais querer perder!
```

Submit. Approval is typically 24-48h.

- [ ] **Step 2: Set Vercel environment variables**

In Vercel → Project → Settings → Environment Variables, for both **Preview** and **Production**:
- `WA_GROUP_INVITE_URL` = the current invite link from the WhatsApp group.

Redeploy or trigger a fresh deploy so the env is loaded.

- [ ] **Step 3: Preview deployment smoke test**

After the PR's preview deployment is live:
- Open `<preview-url>/dashboard/wa/coverage` as admin.
- Use the test input with Ricardo's phone (`+351912873698`).
- If the template is still pending, expect `outcome: "failed", reason: "template_pending"`. That's fine — it confirms the wiring without sending.
- Once Meta approves, repeat: expect `outcome: "sent"` and a real WhatsApp message arrives.

- [ ] **Step 4: Production bulk send**

After the test send succeeds against Ricardo's phone in **production**:
- Press **Convidar todos** on the production coverage page.
- Confirm the dialog.
- Watch the summary toast (`✓ N enviados · M saltados · K falharam`).
- For any failures: open Prisma Studio against the production DB and inspect `WaEvent` rows with `kind: GROUP_INVITE_FAIL` to read the Meta error.

- [ ] **Step 5: Observe coverage drift**

24-48h later, click **Resync** on `/dashboard/wa/coverage`. The **Cobertos** count should rise and **Faltam convidar** should drop as people accept the invite. There's no event from WhatsApp for "joined a group" — Resync is the source of truth.

---

## Verification Summary

| Task | What proves it works |
|---|---|
| 1 | `npx vitest run tests/lib/wa/group-invite.test.ts` — 5 passing |
| 2 | Same vitest run — 10 passing |
| 3 | `curl` against `/api/whatsapp/admin/group-coverage` shows `lastInvite` field on `missingFromGroup` entries |
| 4 | `curl` POST with `dryRun:true` returns `outcome: "dry"` for valid phones, 403 unauthenticated, 400 on bad phones, 500 on missing env |
| 5 | `curl` POST without `dryRun` against Ricardo's phone sends a real template; second call is `skipped`; `force:true` overwrites |
| 6 | Coverage page renders the button, test input, badges; bulk action works end-to-end in the browser |
| 7 | `.env.example` documents `WA_GROUP_INVITE_URL` |
| 8 | Production rollout checklist completed |
