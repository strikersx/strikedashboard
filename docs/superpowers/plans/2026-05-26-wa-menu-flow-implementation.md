# WA Bot Menu Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace keyword-only entry with a 3-button menu (Reservar / Minha agenda / Outros) plus bump cancel cutoff from 15min to 2h.

**Architecture:** Approach A — no new WaSession state. IDLE + text now sends a button menu; the 3 button IDs (`btn_reservar`, `btn_agenda`, `btn_outros`) route to existing handlers. Mid-flow text resets to IDLE and re-shows menu. Cancel flow becomes always-on (`WA_FLOW_CANCELAR` removed). Agenda lists ALL future bookings, with rows marked locked (`⏰` prefix + `_locked` row id suffix) when start time is inside the new 2h cutoff.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7 + libsql (Turso prod / SQLite dev), Vitest, WhatsApp Cloud API v21.0.

**Spec:** `docs/superpowers/specs/2026-05-26-wa-menu-flow-design.md`.

---

## File Structure (decomposition)

**Create:**
- `src/lib/wa/handlers/menu.ts` — `sendMenu(phoneE164)` + `handleOutros(phoneE164)`. Two small functions, one responsibility (menu IO).

**Modify:**
- `src/lib/yogo/signups.ts` — bump `CANCEL_CUTOFF_MS` constant.
- `src/lib/wa/render.ts` — add `renderMenu()`; replace `renderCancelList` with `renderAgendaList` (mixed eligibility).
- `src/lib/wa/handlers/cancelar.ts` — `handleCancelar` uses `renderAgendaList`; `handleCancelPick` recognizes `_locked` suffix.
- `src/lib/wa/dispatch.ts` — IDLE+text → menu; button IDs route to handlers; mid-flow text → reset + menu.
- `src/lib/wa/config.ts` — remove `isCancelarEnabled()`.
- `.env.example` — remove `WA_FLOW_CANCELAR`.
- `tests/lib/wa/render.test.ts` — rename + update existing `renderCancelList` tests; add 4 new (menu, agenda eligible, agenda locked, agenda overflow).
- `tests/lib/yogo/signups.test.ts` — update 2 cutoff tests (15min → 2h).
- `docs/superpowers/runbooks/whatsapp-bot.md` — 3 mentions of "15min" → "2h".

**Delete:**
- `src/lib/wa/handlers/fallback.ts` — dead after dispatch refactor.

**Vercel env cleanup (after merge, separate command):** remove `WA_FLOW_CANCELAR` from production/preview/development.

---

## Task 1: Cutoff change — 15min → 2h

**Files:**
- Modify: `src/lib/yogo/signups.ts:51-53` (the constant declaration)
- Test: `tests/lib/yogo/signups.test.ts` (update 2 existing cases)

- [ ] **Step 1: Read the current cutoff constant and tests**

```bash
grep -n "CANCEL_CUTOFF_MS" src/lib/yogo/signups.ts
grep -n "15-min\|15min\|<15min" tests/lib/yogo/signups.test.ts
```

Expected: see `CANCEL_CUTOFF_MS = 15 * 60 * 1000` in signups.ts; and two test titles mentioning the 15-min cutoff in signups.test.ts.

- [ ] **Step 2: Update the failing tests first (TDD)**

Edit `tests/lib/yogo/signups.test.ts`. Find the two cases inside `describe("isCancellable", () => { ... })`:

Replace:
```ts
  it("rejects classes starting in <15min (cutoff)", () => {
    const now = new Date("2026-05-26T19:00:00");
    const s = makeSignup("2026-05-26", "19:10", {});
    expect(isCancellable(s, now)).toBe(false);
  });

  it("accepts classes starting exactly past the 15-min cutoff", () => {
    const now = new Date("2026-05-26T19:00:00");
    const s = makeSignup("2026-05-26", "19:16", {});
    expect(isCancellable(s, now)).toBe(true);
  });
```

With:
```ts
  it("rejects classes starting in <2h (cutoff)", () => {
    const now = new Date("2026-05-26T19:00:00");
    const s = makeSignup("2026-05-26", "20:30", {});  // 1h30m away — within cutoff
    expect(isCancellable(s, now)).toBe(false);
  });

  it("accepts classes starting exactly past the 2h cutoff", () => {
    const now = new Date("2026-05-26T19:00:00");
    const s = makeSignup("2026-05-26", "21:01", {});  // 2h01m away — just past cutoff
    expect(isCancellable(s, now)).toBe(true);
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/lib/yogo/signups.test.ts`

Expected: 2 tests FAIL with assertion errors (the constant is still 15min, so a 1h30m-away class is still cancellable per old logic, and a 2h01m-away class is still cancellable too — which means the rejection test fails since `false` is expected but `true` is returned).

- [ ] **Step 4: Bump the constant in signups.ts**

Edit `src/lib/yogo/signups.ts`. Find:

```ts
// 15min cutoff guards against cancellations after a class has effectively
// started — Yogo would still accept, but the student loses the paid slot.
const CANCEL_CUTOFF_MS = 15 * 60 * 1000;
```

Replace with:

```ts
// 2h cutoff so the studio can reassign the slot if someone cancels late.
// Yogo's admin UI has no cutoff — Marcelo can still override manually.
const CANCEL_CUTOFF_MS = 2 * 60 * 60 * 1000;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/lib/yogo/signups.test.ts`

Expected: all 9 cases PASS.

- [ ] **Step 6: Run full test suite to confirm no other test breaks**

Run: `npm test`

Expected: 119 passed, 1 skipped (G2 spike). If any test breaks, investigate before continuing — likely a test in render or cancelar.test that depended on the 15min boundary.

- [ ] **Step 7: Commit**

```bash
git add src/lib/yogo/signups.ts tests/lib/yogo/signups.test.ts
git commit -m "fix(cancel): bump cancel cutoff from 15min to 2h

Studio policy change — alunos must cancel at least 2 hours before
class start so the slot can be reassigned. Yogo admin UI keeps no
cutoff so Marcelo retains override.

Updates the 2 existing isCancellable cases."
```

---

## Task 2: renderMenu — 3-button payload

**Files:**
- Modify: `src/lib/wa/render.ts` (add a new function next to existing renderers)
- Test: `tests/lib/wa/render.test.ts` (add 1 new describe block)

- [ ] **Step 1: Write the failing test**

Edit `tests/lib/wa/render.test.ts`. Add the test at the bottom of the file, after the existing `describe("renderConfirmCancel", ...)` block. First import `renderMenu`:

```ts
import {
  renderCancelList,
  renderClassList,
  renderConfirmBook,
  renderConfirmCancel,
  renderMenu,
  type SignupLite,
  type YogoClassLite,
} from "../../../src/lib/wa/render";
```

Then add at the end of the file:

```ts
describe("renderMenu", () => {
  it("renders a 3-button menu with the expected ids and titles", () => {
    const out = renderMenu();
    expect(out.type).toBe("button");
    expect(out.bodyText).toBe("Olá! O que precisas?");
    expect(out.buttons).toEqual([
      { id: "btn_reservar", title: "Reservar" },
      { id: "btn_agenda", title: "Minha agenda" },
      { id: "btn_outros", title: "Outros" },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/wa/render.test.ts`

Expected: FAIL with `renderMenu is not exported` from `../../../src/lib/wa/render`.

- [ ] **Step 3: Implement renderMenu in render.ts**

Edit `src/lib/wa/render.ts`. Add the function near the other render functions (after `renderConfirmCancel`):

```ts
// Top-of-funnel menu. WhatsApp button payload caps title at 20c and supports
// max 3 buttons — both honoured here.
export function renderMenu(): WaButtonPayload {
  return {
    type: "button",
    bodyText: "Olá! O que precisas?",
    buttons: [
      { id: "btn_reservar", title: "Reservar" },
      { id: "btn_agenda", title: "Minha agenda" },
      { id: "btn_outros", title: "Outros" },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/wa/render.test.ts`

Expected: all tests PASS including the new renderMenu case.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wa/render.ts tests/lib/wa/render.test.ts
git commit -m "feat(wa): renderMenu — 3-button welcome payload

Returns the WaButtonPayload used by the new top-of-funnel menu
(Reservar / Minha agenda / Outros). Pure function, no side effects."
```

---

## Task 3: renderAgendaList replaces renderCancelList (mixed eligibility)

**Files:**
- Modify: `src/lib/wa/render.ts` (rename + rewrite renderCancelList → renderAgendaList; signature changes)
- Modify: `src/lib/wa/handlers/cancelar.ts` (call site switches)
- Test: `tests/lib/wa/render.test.ts` (rename + augment 4 existing tests; add 2 new for mixed eligibility)

- [ ] **Step 1: Read the current renderCancelList to understand the signature**

Run: `grep -n "renderCancelList\|MAX_TOTAL_ROWS" src/lib/wa/render.ts`

Expected: 1 function definition, 1 constant. Note the current signature `renderCancelList(signups: SignupLite[]): WaListPayload | WaTextPayload`.

- [ ] **Step 2: Write failing tests for renderAgendaList**

Edit `tests/lib/wa/render.test.ts`. Find the existing `describe("renderCancelList", ...)` block. Replace the entire block (including all 4 of its `it()` cases) with:

```ts
function agendaSignup(id: number, date: string, time: string, name: string): SignupLite {
  return { id, klass: { id: id * 100, date, start_time: time, class_type: { name } } };
}

describe("renderAgendaList", () => {
  it("text response when empty", () => {
    expect(renderAgendaList([])).toEqual({
      type: "text",
      body: "Não tens aulas marcadas.",
    });
  });

  it("renders an interactive list for ≤10 signups (all eligible)", () => {
    const now = new Date("2026-05-26T10:00:00");
    const list = [
      agendaSignup(1, "2026-05-26", "19:30", "Striking"),
      agendaSignup(2, "2026-05-27", "10:00", "BJJ"),
    ];
    const out = renderAgendaList(list.map((s) => ({ ...s, cancellable: true })), now);
    expect(out.type).toBe("list");
    if (out.type !== "list") throw new Error("type narrow");
    expect(out.sections).toHaveLength(1);
    expect(out.sections[0].title).toBe("PRÓXIMAS");
    expect(out.sections[0].rows.map((r) => r.id)).toEqual(["1", "2"]);
    expect(out.sections[0].rows[0].title.startsWith("⏰")).toBe(false);
  });

  it("marks rows as locked when cancellable=false", () => {
    const now = new Date("2026-05-26T19:00:00");
    const list = [
      { ...agendaSignup(1, "2026-05-26", "19:30", "Striking"), cancellable: false },
      { ...agendaSignup(2, "2026-05-26", "21:30", "Boxing"), cancellable: true },
    ];
    const out = renderAgendaList(list, now);
    if (out.type !== "list") throw new Error("expected list");
    expect(out.sections[0].rows[0].id).toBe("1_locked");
    expect(out.sections[0].rows[0].title.startsWith("⏰")).toBe(true);
    expect(out.sections[0].rows[0].description).toBe("em breve · não cancelável");
    expect(out.sections[0].rows[1].id).toBe("2");
    expect(out.sections[0].rows[1].title.startsWith("⏰")).toBe(false);
  });

  it("falls back to free-text DD/MM HH:MM past 10 signups", () => {
    const now = new Date("2026-05-26T10:00:00");
    const list = Array.from({ length: 11 }, (_, i) =>
      ({ ...agendaSignup(i + 1, "2026-05-27", "19:30", "Aula"), cancellable: true }),
    );
    const out = renderAgendaList(list, now);
    expect(out.type).toBe("text");
    if (out.type !== "text") throw new Error("type narrow");
    expect(out.body).toMatch(/DD\/MM HH:MM/);
  });

  it("renders single-section list when only 1 signup", () => {
    const now = new Date("2026-05-26T10:00:00");
    const list = [{ ...agendaSignup(1, "2026-05-26", "19:30", "Striking"), cancellable: true }];
    const out = renderAgendaList(list, now);
    if (out.type !== "list") throw new Error("expected list");
    expect(out.sections).toHaveLength(1);
    expect(out.sections[0].title).toBe("PRÓXIMAS");
  });
});
```

Also remove the `renderCancelList` symbol from the file's import block at the top:

```ts
import {
  renderAgendaList,           // ← renamed from renderCancelList
  renderClassList,
  renderConfirmBook,
  renderConfirmCancel,
  renderMenu,
  type SignupLite,
  type YogoClassLite,
} from "../../../src/lib/wa/render";
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/lib/wa/render.test.ts`

Expected: 5 FAILs — `renderAgendaList is not exported`. (You'll also get a typecheck-style error in the editor; vitest reports the runtime side.)

- [ ] **Step 4: Implement renderAgendaList in render.ts**

Edit `src/lib/wa/render.ts`. Find:

```ts
// Cancel picker. N=1 still shows a confirm prompt (spec: mandatory confirm
// even for a single signup, so a stray tap doesn't burn the slot). N=2..10
// list. N>10 falls back to free-text DD/MM HH:MM (Meta's 10-total-row cap).
export function renderCancelList(signups: SignupLite[]): WaListPayload | WaTextPayload {
  if (signups.length === 0) {
    return { type: "text", body: "Sem aulas marcadas nos próximos dias." };
  }
  if (signups.length > MAX_TOTAL_ROWS) {
    return {
      type: "text",
      body: "Tens muitas marcações. Escreve a data e hora (DD/MM HH:MM) da aula a cancelar.",
    };
  }
  const rows = signups.map((s) => ({
    id: String(s.id),
    title: truncate(`${s.klass.start_time} ${s.klass.class_type?.name ?? "Aula"}`, MAX_ROW_TITLE),
    description: truncate(s.klass.date, MAX_ROW_DESC),
  }));
  return {
    type: "list",
    bodyText: "Escolhe a aula para cancelar:",
    buttonText: "Ver marcações",
    sections: [{ title: "PRÓXIMAS", rows }],
  };
}
```

Replace with:

```ts
// Agenda picker — used by the "Minha agenda" menu button. Shows ALL future
// bookings; rows whose class starts inside the cancel cutoff (see
// CANCEL_CUTOFF_MS in src/lib/yogo/signups.ts) are flagged with a ⏰ prefix
// and a `_locked` row-id suffix so the click handler can refuse politely
// instead of attempting a Yogo DELETE.
//
// Caller passes an `cancellable` flag per signup (typically derived from
// `isCancellable(signup, now)` in src/lib/yogo/signups.ts) — the renderer
// stays pure and side-effect free.
export interface AgendaItem extends SignupLite {
  cancellable: boolean;
}

export function renderAgendaList(items: AgendaItem[], _now: Date = new Date()): WaListPayload | WaTextPayload {
  void _now; // reserved for future formatting (e.g. "em 2h 15min")
  if (items.length === 0) {
    return { type: "text", body: "Não tens aulas marcadas." };
  }
  if (items.length > MAX_TOTAL_ROWS) {
    return {
      type: "text",
      body: "Tens muitas marcações. Escreve a data e hora (DD/MM HH:MM) da aula a cancelar.",
    };
  }
  const rows = items.map((item) => {
    const baseTitle = `${item.klass.start_time} ${item.klass.class_type?.name ?? "Aula"}`;
    if (item.cancellable) {
      return {
        id: String(item.id),
        title: truncate(baseTitle, MAX_ROW_TITLE),
        description: truncate(item.klass.date, MAX_ROW_DESC),
      };
    }
    return {
      id: `${item.id}_locked`,
      title: truncate(`⏰ ${baseTitle}`, MAX_ROW_TITLE),
      description: "em breve · não cancelável",
    };
  });
  return {
    type: "list",
    bodyText: "Escolhe a aula para cancelar:",
    buttonText: "Ver marcações",
    sections: [{ title: "PRÓXIMAS", rows }],
  };
}
```

- [ ] **Step 5: Update the handleCancelar call site so the file compiles**

Edit `src/lib/wa/handlers/cancelar.ts`. Find the import:

```ts
import {
  renderCancelList,
  renderConfirmCancel,
  type SignupLite,
  type YogoClassLite,
} from "@/lib/wa/render";
```

Replace with:

```ts
import {
  renderAgendaList,
  renderConfirmCancel,
  type AgendaItem,
  type SignupLite,
  type YogoClassLite,
} from "@/lib/wa/render";
```

Then find the body of `handleCancelar` that calls `renderCancelList`:

```ts
  const cancellable = all.filter((s) => isCancellable(s)).map(toSignupLite);

  if (cancellable.length === 0) {
    await sendText(phoneE164, NO_SIGNUPS);
    return;
  }
```

Replace the first 2 lines (the filter+map and the empty check that follows) with the new mixed-eligibility build:

```ts
  // Build the agenda items: include EVERY future signup, but mark each as
  // cancellable or locked. The renderer turns locked items into ⏰ rows.
  const now = new Date();
  const items: AgendaItem[] = all
    .filter((s) => !s.cancelled_at && typeof s.class === "object")
    .map((s) => ({
      ...toSignupLite(s),
      cancellable: isCancellable(s, now),
    }));

  if (items.length === 0) {
    await sendText(phoneE164, NO_SIGNUPS);
    return;
  }
```

Also find the constant near the top of cancelar.ts:

```ts
const NO_SIGNUPS = "Não tens marcações canceláveis (cutoff 15min antes da aula).";
```

Replace with:

```ts
const NO_SIGNUPS = "Não tens aulas marcadas.";
```

Now find where it builds the payload — look for `renderCancelList`:

```ts
  // N=2..20: interactive list.
  // N>20: free-text DD/MM HH:MM fallback.
  const payload = renderCancelList(cancellable);
```

Replace with:

```ts
  // N=2..10 interactive list (mixed eligibility); >10 → free-text DD/MM HH:MM.
  const payload = renderAgendaList(items, now);
```

And the N=1 special-case earlier — it currently uses the cancellable array's [0]. We need to point it at items[0] but only if cancellable. If the only future signup is locked, we still show a 1-row list so the user sees they have a class soon. Replace this block:

```ts
  // N=1: still ask for confirm (spec: mandatory even for single signup).
  if (cancellable.length === 1) {
    const t = await transition(session, {
      state: "AWAIT_CONFIRM_CANCEL",
      pendingSignupId: cancellable[0].id,
      expiresAt: ttlFromNow(),
    });
    if (!t.ok) {
      await db.waEvent.create({ data: { kind: "SESSION_RACE", phoneE164 } });
      return;
    }
    await sendButton(phoneE164, renderConfirmCancel(cancellable[0]));
    return;
  }
```

with:

```ts
  // N=1 cancellable + 0 locked: skip the list and ask confirm directly.
  if (items.length === 1 && items[0].cancellable) {
    const t = await transition(session, {
      state: "AWAIT_CONFIRM_CANCEL",
      pendingSignupId: items[0].id,
      expiresAt: ttlFromNow(),
    });
    if (!t.ok) {
      await db.waEvent.create({ data: { kind: "SESSION_RACE", phoneE164 } });
      return;
    }
    await sendButton(phoneE164, renderConfirmCancel(items[0]));
    return;
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/lib/wa/render.test.ts`

Expected: all 5 new renderAgendaList cases PASS.

- [ ] **Step 7: Run full test suite**

Run: `npm test`

Expected: 119 passed, 1 skipped. If `tests/lib/wa/render.test.ts` count changed, that's fine — the previous 5 renderCancelList tests were replaced by 5 renderAgendaList tests (1:1).

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`

Expected: zero errors. If there's a `renderCancelList is not exported` error elsewhere, search for it: `grep -rn "renderCancelList" src/` should return zero hits.

- [ ] **Step 9: Commit**

```bash
git add src/lib/wa/render.ts src/lib/wa/handlers/cancelar.ts tests/lib/wa/render.test.ts
git commit -m "feat(wa): renderAgendaList — mixed eligibility, replaces renderCancelList

'Minha agenda' button needs to show ALL future bookings, with rows
inside the 2h cancel cutoff marked locked instead of hidden. Pure
renderer; caller computes cancellable via isCancellable(signup, now).

- Locked rows get '⏰ ' prefix and '<id>_locked' row id.
- Empty message shifted from 'Não tens marcações canceláveis' (spec
  language) to 'Não tens aulas marcadas.' (matches the agenda framing).
- handleCancelar updated to build AgendaItem[] and skip the list when
  there's exactly one cancellable signup."
```

---

## Task 4: handleCancelPick recognises `_locked` suffix

**Files:**
- Modify: `src/lib/wa/handlers/cancelar.ts` (top of `handleCancelPick`)
- No new test — covered by the renderer test (which guarantees the suffix shape) plus manual smoke.

- [ ] **Step 1: Read the current handleCancelPick**

Run: `grep -n "handleCancelPick" src/lib/wa/handlers/cancelar.ts | head -3`

Locate the function; note the existing `Number.isFinite(signupId)` invalid-selection branch — we add the locked branch *before* it.

- [ ] **Step 2: Add the locked branch**

Edit `src/lib/wa/handlers/cancelar.ts`. Find the function:

```ts
export async function handleCancelPick(session: SessionRow, signupIdRaw: string): Promise<void> {
  const signupId = Number(signupIdRaw);
  if (!Number.isFinite(signupId)) {
    await sendText(session.phoneE164, "Selecção inválida. Diz cancelar para começar de novo.");
    return;
  }
```

Replace the body opening with:

```ts
export async function handleCancelPick(session: SessionRow, signupIdRaw: string): Promise<void> {
  // Locked rows come through with a `_locked` suffix (see renderAgendaList).
  // Aluno tapped a class that starts inside the 2h cutoff — refuse politely,
  // keep the session in AWAIT_CANCEL_PICK so they can pick a different row
  // from the same list without re-entering the agenda.
  if (signupIdRaw.endsWith("_locked")) {
    await sendText(session.phoneE164, "Esta aula começa em menos de 2h. Não dá para cancelar.");
    return;
  }

  const signupId = Number(signupIdRaw);
  if (!Number.isFinite(signupId)) {
    await sendText(session.phoneE164, "Selecção inválida. Diz cancelar para começar de novo.");
    return;
  }
```

- [ ] **Step 3: Run test suite**

Run: `npm test`

Expected: 119 passed, 1 skipped. The locked behaviour is not directly tested (no new test); the renderer test guarantees the suffix shape and the handler is a thin string-match. We rely on the smoke test in Task 9 to verify end-to-end.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wa/handlers/cancelar.ts
git commit -m "feat(wa): handleCancelPick refuses '_locked' row ids

Rows produced by renderAgendaList for classes inside the 2h cutoff
carry a '_locked' suffix on their row id. handleCancelPick now
detects the suffix and replies with the 2h-cutoff explanation
instead of trying to parse the id as a signup number.

Session stays in AWAIT_CANCEL_PICK so the aluno can pick a
different row from the same list."
```

---

## Task 5: menu handler — sendMenu + handleOutros

**Files:**
- Create: `src/lib/wa/handlers/menu.ts`
- No new test — pure IO wrappers around `sendButton`/`sendText`; covered by Task 9 smoke.

- [ ] **Step 1: Create the file**

Create `src/lib/wa/handlers/menu.ts` with:

```ts
import { sendButton, sendText } from "@/lib/wa/meta";
import { renderMenu } from "@/lib/wa/render";

const OUTROS_MSG = "Entre em contato com o número de atendimento.";

// Top-of-funnel menu. Anything the aluno types in IDLE state triggers this
// (dispatch.ts routes here). The 3 buttons map 1:1 to existing flows via
// their `id` values: btn_reservar → handleReservar, btn_agenda →
// handleCancelar, btn_outros → handleOutros.
export async function sendMenu(phoneE164: string): Promise<void> {
  await sendButton(phoneE164, renderMenu());
}

// "Outros" button → static message. No state change. Aluno just writes
// freely afterwards and Marcelo reads via Meta Business Suite.
export async function handleOutros(phoneE164: string): Promise<void> {
  await sendText(phoneE164, OUTROS_MSG);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`

Expected: zero errors.

- [ ] **Step 3: Run tests (no new tests, just confirm none broke)**

Run: `npm test`

Expected: 119 passed, 1 skipped.

- [ ] **Step 4: Commit**

```bash
git add src/lib/wa/handlers/menu.ts
git commit -m "feat(wa): menu.ts — sendMenu + handleOutros

Thin IO wrappers around the new renderMenu payload and the 'Outros'
static reply. Not wired into dispatch yet — Task 6 routes the
button IDs."
```

---

## Task 6: dispatch.ts — IDLE+text shows menu, route 3 button IDs, mid-flow text resets

**Files:**
- Modify: `src/lib/wa/dispatch.ts` (rewrite the routing section)
- No new test (per spec §9 — dispatch is integration-tested via smoke).

- [ ] **Step 1: Read the current dispatch.ts**

Run: `cat src/lib/wa/dispatch.ts`

Note the existing structure: kill-switch echo, parseIntent + loadSession + expiry reset, then a `if (intent.kind === "reservar")` block, a `if (intent.kind === "cancelar")` block, and a state-machine switch with a `handleFallback` default in IDLE.

- [ ] **Step 2: Rewrite the file**

Replace the entire contents of `src/lib/wa/dispatch.ts` with:

```ts
import { db } from "@/lib/db";
import { isReservarEnabled } from "@/lib/wa/config";
import { parseIntent, type MetaInboundMessage } from "@/lib/wa/parser";
import { isExpired, loadSession, resetToIdle, type SessionRow } from "@/lib/wa/session";
import { sendText } from "@/lib/wa/meta";
import {
  handleClassPick,
  handleConfirmBook,
  handleCancelBook,
  handleReservar,
} from "@/lib/wa/handlers/reservar";
import {
  handleAbortCancel,
  handleCancelPick,
  handleCancelPickByText,
  handleCancelar,
  handleConfirmCancel,
} from "@/lib/wa/handlers/cancelar";
import { handleOutros, sendMenu } from "@/lib/wa/handlers/menu";

// Dispatch routes an inbound WhatsApp message based on (1) menu button IDs,
// (2) the session's current state, and (3) the intent kind from the parser.
//
// Top-of-funnel UX: any text in IDLE shows the menu (Reservar / Minha agenda
// / Outros). The 3 button replies fire the corresponding flows from anywhere
// (state is reset first). Mid-flow text resets to IDLE and re-shows the menu
// — there is no contextual text fallback anymore.
export async function dispatch(phoneE164: string, message: MetaInboundMessage): Promise<void> {
  if (!isReservarEnabled()) {
    // Slice-2 echo retained for emergency rollback. Should not be reached
    // once WA_FLOW_RESERVAR=true in prod.
    const body = message.text?.body ?? "";
    const result = await sendText(phoneE164, `echo: ${body}`);
    if (!result.ok) {
      await db.waEvent
        .create({
          data: {
            kind: "SEND_FAIL",
            phoneE164,
            meta: JSON.stringify({ status: result.status, body: result.body.slice(0, 300) }),
          },
        })
        .catch(() => undefined);
    }
    return;
  }

  const intent = parseIntent(message);
  let session = await loadSession(phoneE164);
  if (isExpired(session)) {
    const reset = await resetToIdle(session);
    if (reset.ok) session = reset.session;
  }

  // Menu buttons are the universal "start over" signal. Reset state first
  // so the handler runs in a clean IDLE-equivalent.
  if (intent.kind === "button") {
    if (intent.id === "btn_reservar") {
      session = await ensureIdle(session);
      return handleReservar(session);
    }
    if (intent.id === "btn_agenda") {
      session = await ensureIdle(session);
      return handleCancelar(session);
    }
    if (intent.id === "btn_outros") {
      session = await ensureIdle(session);
      return handleOutros(phoneE164);
    }
    // Otherwise fall through to flow-specific button routing below.
  }

  switch (session.state) {
    case "AWAIT_CLASS_PICK":
      if (intent.kind === "list_pick") return handleClassPick(session, intent.id);
      if (intent.kind === "button" && intent.id === "confirm_book") return handleConfirmBook(session);
      if (intent.kind === "button" && intent.id === "cancel_book") return handleCancelBook(session);
      // Any text or other input → reset and re-show menu.
      await resetToIdle(session);
      return sendMenu(phoneE164);

    case "AWAIT_CONFIRM_BOOK":
      if (intent.kind === "button" && intent.id === "confirm_book") return handleConfirmBook(session);
      if (intent.kind === "button" && intent.id === "cancel_book") return handleCancelBook(session);
      await resetToIdle(session);
      return sendMenu(phoneE164);

    case "AWAIT_CANCEL_PICK":
      if (intent.kind === "list_pick") return handleCancelPick(session, intent.id);
      // Free-text DD/MM HH:MM is the documented fallback when there are >10
      // signups, so we keep it routed here.
      if (intent.kind === "text") return handleCancelPickByText(session, intent.body);
      await resetToIdle(session);
      return sendMenu(phoneE164);

    case "AWAIT_CONFIRM_CANCEL":
      if (intent.kind === "button" && intent.id === "confirm_cancel") return handleConfirmCancel(session);
      if (intent.kind === "button" && intent.id === "abort_cancel") return handleAbortCancel(session);
      await resetToIdle(session);
      return sendMenu(phoneE164);

    case "IDLE":
    default:
      // Anything in IDLE → menu. Keywords ('reserva', 'cancelar') hit this
      // branch too because parseIntent still classifies them as text-like
      // intents, but we deliberately ignore the kind here.
      return sendMenu(phoneE164);
  }
}

async function ensureIdle(session: SessionRow): Promise<SessionRow> {
  if (session.state === "IDLE") return session;
  const reset = await resetToIdle(session);
  return reset.ok ? reset.session : session;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: zero errors. If there's a complaint about `handleFallback` being imported elsewhere, search and remove: `grep -rn "handleFallback\|src/lib/wa/handlers/fallback" src/` — should return only `src/lib/wa/handlers/fallback.ts` itself (which we delete in Task 7).

- [ ] **Step 4: Run full test suite**

Run: `npm test`

Expected: 119 passed, 1 skipped.

- [ ] **Step 5: Build smoke (local)**

Run: `npm run build 2>&1 | grep -E "Compiled|prerender|Error"`

Expected: `✓ Compiled successfully …` then the same pre-existing `/_global-error` prerender failure that's documented in `.nvmrc` notes. No NEW errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/wa/dispatch.ts
git commit -m "feat(wa): dispatch routes 3 menu buttons + sends menu on IDLE text

Top-of-funnel rewrite — IDLE+text now sends the 3-button menu instead
of the keyword nudge text. Button IDs btn_reservar / btn_agenda /
btn_outros route to existing handlers after a state reset, so they
work from any session state. Mid-flow text in AWAIT_* states resets
to IDLE and re-shows the menu (no more contextual text fallback).

handleFallback no longer called — file deletion in next commit."
```

---

## Task 7: Cleanup — delete fallback.ts, remove WA_FLOW_CANCELAR

**Files:**
- Delete: `src/lib/wa/handlers/fallback.ts`
- Modify: `src/lib/wa/config.ts` (remove `isCancelarEnabled`)
- Modify: `.env.example` (remove `WA_FLOW_CANCELAR=false`)
- Modify: `vitest.config.ts` (drop the now-removed fallback.ts from coverage exclude)

- [ ] **Step 1: Verify fallback.ts has zero callers**

Run: `grep -rn "handleFallback\|handlers/fallback" src/`

Expected: only the file itself (`src/lib/wa/handlers/fallback.ts`) appears. If anything else is listed, fix that callsite first (it's likely a leftover from Task 6).

- [ ] **Step 2: Delete the fallback file**

Run: `git rm src/lib/wa/handlers/fallback.ts`

Expected: file removed; the deletion is staged.

- [ ] **Step 3: Verify isCancelarEnabled has zero callers**

Run: `grep -rn "isCancelarEnabled" src/`

Expected: only `src/lib/wa/config.ts` appears. If `dispatch.ts` still references it, something went wrong in Task 6.

- [ ] **Step 4: Remove isCancelarEnabled from config.ts**

Edit `src/lib/wa/config.ts`. Find:

```ts
export function isCancelarEnabled(): boolean {
  return process.env.WA_FLOW_CANCELAR === "true";
}
```

Delete those 3 lines (and the comment immediately above if it specifically mentions cancelar — keep the generic per-flow flag comment if it talks about both).

- [ ] **Step 5: Remove WA_FLOW_CANCELAR from .env.example**

Edit `.env.example`. Find:

```
WA_FLOW_RESERVAR=false
WA_FLOW_CANCELAR=false
```

Replace with:

```
WA_FLOW_RESERVAR=false
```

- [ ] **Step 6: Update vitest coverage exclude**

Edit `vitest.config.ts`. Find:

```ts
        "src/lib/wa/handlers/fallback.ts",
```

Delete that line. Add `src/lib/wa/handlers/menu.ts` in its place:

```ts
        "src/lib/wa/handlers/menu.ts",
```

(menu.ts is a thin IO wrapper, same exclusion rationale as reservar/cancelar handlers.)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`

Expected: zero errors.

- [ ] **Step 8: Run full test suite**

Run: `npm test`

Expected: 119 passed, 1 skipped.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore(wa): delete fallback.ts, remove WA_FLOW_CANCELAR flag

Cancel flow becomes always-on (it's reached via the 'Minha agenda'
menu button, no flag indirection needed). fallback.ts is dead code
after dispatch rewrite.

Post-merge: run \`vercel env rm WA_FLOW_CANCELAR\` for production,
preview, development."
```

---

## Task 8: Runbook — 15min → 2h

**Files:**
- Modify: `docs/superpowers/runbooks/whatsapp-bot.md` (3 textual mentions)

- [ ] **Step 1: Find all cutoff mentions**

Run: `grep -n "15min\|15 min" docs/superpowers/runbooks/whatsapp-bot.md`

Expected: 2–4 hits. Each one needs to flip to "2h".

- [ ] **Step 2: Replace each mention**

Edit `docs/superpowers/runbooks/whatsapp-bot.md`. For each line returned by Step 1, change `15min` → `2h` and adjust surrounding wording if it reads awkward (e.g. "no menos de 2h antes" is fine; "15 minutos antes" → "2 horas antes").

If the runbook describes "the 15-min cutoff guards against losing slots to mid-class taps", update to: "the 2h cutoff gives the studio time to reassign the slot."

- [ ] **Step 3: Verify no 15min mention remains**

Run: `grep -n "15min\|15 min" docs/superpowers/runbooks/whatsapp-bot.md`

Expected: zero hits.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/runbooks/whatsapp-bot.md
git commit -m "docs(runbook): cancel cutoff is 2h, not 15min"
```

---

## Task 9: Final verification + push + open PR

**Files:** none — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: 119 passed, 1 skipped (G2 spike).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`

Expected: zero errors.

- [ ] **Step 3: Local build smoke**

Run: `npm run build 2>&1 | tail -15`

Expected: `✓ Compiled successfully …` followed by the documented pre-existing `/_global-error` prerender failure (digest `2152396461`). No NEW errors. If the failure shape changed, investigate before pushing.

- [ ] **Step 4: Confirm no dead imports**

Run: `grep -rn "renderCancelList\|isCancelarEnabled\|handleFallback\|WA_FLOW_CANCELAR" src/ .env.example`

Expected: zero hits.

- [ ] **Step 5: Look at the branch diff**

Run: `git log --oneline main..HEAD` (or `origin/main..HEAD` if you're working on a feature branch)

Expected: 8 commits, one per Task 1–8. Counts should look roughly like:
- Task 1 (cutoff): ~10 lines changed
- Task 2 (renderMenu): ~30 added
- Task 3 (renderAgendaList): ~80 added/changed
- Task 4 (handleCancelPick): ~10 added
- Task 5 (menu.ts): ~25 added
- Task 6 (dispatch.ts): ~50 added/changed
- Task 7 (cleanup): ~15 removed
- Task 8 (runbook): ~3 changed

Total: ~200 LOC, as scoped.

- [ ] **Step 6: Push the branch**

Run: `git push -u origin $(git branch --show-current)`

Expected: branch pushed; gh CLI prints a URL to open a PR.

- [ ] **Step 7: Open the PR via gh**

```bash
gh pr create --repo strikersx/strikedashboard --base main --head $(git branch --show-current) \
  --title "feat(wa): menu-led entry flow + 2h cancel cutoff" \
  --body "$(cat <<'EOF'
Implements `docs/superpowers/specs/2026-05-26-wa-menu-flow-design.md`.

Top-of-funnel UX change: any text in IDLE → 3-button menu
(Reservar / Minha agenda / Outros). 'Minha agenda' shows ALL future
bookings with `⏰` prefixed rows for classes inside the new 2h cancel
cutoff. WA_FLOW_CANCELAR flag removed — cancel always on.

8 commits, ~200 LOC. Single PR.

## Manual smoke after Vercel preview deploys

From the test recipient phone:

1. Text "olá" → see 3-button menu.
2. Tap **Reservar** → class list (existing flow).
3. Tap **Minha agenda**:
   - With ≥1 booking >2h away → row tappable → confirm → cancel.
   - With booking <2h away → row shows `⏰` + 'em breve · não cancelável'; tap → blocked text.
   - With 0 bookings → 'Não tens aulas marcadas.'
4. Tap **Outros** → 'Entre em contato com o número de atendimento.'
5. Mid-flow text: after **Reservar** tap, while class list is open, type 'olá' → menu re-appears.

## Post-merge cleanup

\`\`\`bash
vercel env rm WA_FLOW_CANCELAR production
vercel env rm WA_FLOW_CANCELAR preview
vercel env rm WA_FLOW_CANCELAR development
vercel --prod
\`\`\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 8: Manual smoke checklist (after Vercel preview deploys)**

Wait for the Vercel preview build to finish. Then run through the 5-step smoke in the PR body above. Each step should match the expected behaviour. If any step diverges, file an inline PR comment with the deviation + the relevant `WaEvent` rows from a Turso query (see runbook for the SQL).

- [ ] **Step 9: Post-merge — clean up the Vercel env**

After the PR merges, run from the repo root:

```bash
vercel env rm WA_FLOW_CANCELAR production --yes
vercel env rm WA_FLOW_CANCELAR preview --yes
vercel env rm WA_FLOW_CANCELAR development --yes
```

Expected: 3 successful removals. Then deploy prod:

```bash
vercel --prod
```

Expected: production URL aliased to `strikehousedashboard.vercel.app`.

---

## Self-Review (done before plan handoff)

**Spec coverage:**
| Spec section | Implemented by |
|---|---|
| §3 state machine (3 button IDs, mid-flow reset) | Task 6 |
| §4 menu payload + Outros text | Task 5 + Task 2 (`renderMenu`) |
| §5 Minha agenda detailed flow + locked rows | Tasks 3 + 4 |
| §6 cutoff 15min → 2h + test updates | Task 1 |
| §7 file table | Tasks 1–8 (one file per task or grouped by responsibility) |
| §8 Vercel env cleanup | Task 9 step 9 |
| §9 tests | Tasks 1 (cutoff), 2 (menu), 3 (agenda); none for dispatch per spec |
| §10 manual smoke | Task 9 step 8 |
| §11 rollback (regexes stay harmless) | Task 6 keeps parser.ts untouched |
| §12 — no open questions | n/a |

No spec section is missing a task.

**Placeholder scan:** no TBD/TODO/handwaves. Every code step contains the full code block. Test files include actual fixtures. Commit messages are complete.

**Type consistency:** `AgendaItem` is defined in Task 3 and consumed in Task 3 (call site) + Task 4 (no usage). `SessionRow` import is added in dispatch (Task 6) for the helper. `MetaInboundMessage` import retained. No stale type references.

Plan ready.
