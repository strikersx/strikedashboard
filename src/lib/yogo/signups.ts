import { yogoFetch } from "@/lib/yogo/fetch";
import { findCustomerByPhone } from "@/lib/yogo/lookup";

export interface YogoClass {
  id: number;
  date: string;
  start_time: string;
  end_time?: string;
  cancelled?: number | boolean;
  seats?: number;
  signup_count?: number;
  class_type?: { id: number; name?: string } | null;
  signups?: Array<{ user_id?: number; user?: { id?: number }; cancelled_at?: number | null }>;
}

export async function listClasses(startDate: string, endDate: string): Promise<YogoClass[]> {
  const params = new URLSearchParams({ startDate, endDate });
  params.append("populate[]", "class_type");
  params.append("populate[]", "signup_count");
  params.append("populate[]", "signups");
  const res = await yogoFetch<unknown>(`classes?${params.toString()}`);
  if (!res.ok) return [];
  // Yogo wraps the classes endpoint in { responseType, populate, classes: [...] }
  // (verified against live API 2026-05-26). Other endpoints return bare arrays;
  // accept both shapes defensively.
  if (Array.isArray(res.data)) return res.data as YogoClass[];
  if (res.data && typeof res.data === "object") {
    const wrapped = (res.data as { classes?: unknown }).classes;
    if (Array.isArray(wrapped)) return wrapped as YogoClass[];
  }
  return [];
}

// Filter helper: keeps only classes that are not cancelled, have a seat free,
// and the given user is not already booked into.
export function bookableFor(klass: YogoClass, userId: number): boolean {
  if (klass.cancelled) return false;
  if (
    typeof klass.signup_count === "number" &&
    typeof klass.seats === "number" &&
    klass.signup_count >= klass.seats
  ) {
    return false;
  }
  const signups = klass.signups ?? [];
  for (const s of signups) {
    if (s.cancelled_at) continue;
    const sid = s.user_id ?? s.user?.id;
    if (sid === userId) return false;
  }
  return true;
}

export type CreateSignupResult =
  | { kind: "ok" }
  | { kind: "already_booked" } // 409
  | { kind: "no_plan" }        // 403
  | { kind: "server_error"; status: number };

// Yogo requires `user` as a STRING; integers return 500. (See yogo skill.)
export async function createSignup(userId: number, classId: number): Promise<CreateSignupResult> {
  const res = await yogoFetch<unknown>("class-signups", {
    method: "POST",
    body: JSON.stringify({ user: String(userId), class: classId, checked_in: false }),
  });
  if (res.ok) return { kind: "ok" };
  if (res.status === 409) return { kind: "already_booked" };
  if (res.status === 403) return { kind: "no_plan" };
  return { kind: "server_error", status: res.status };
}

export interface YogoSignup {
  id: number;
  user_id?: number;
  user?: number | { id?: number };
  class?: number | YogoClass;
  cancelled_at?: number | null;
}

// Future signups for a user, populated with the nested class so handlers can
// show date/time without an extra round-trip.
export async function listFutureSignups(userId: number, fromDate: string, toDate: string): Promise<YogoSignup[]> {
  const params = new URLSearchParams({ user: String(userId), startDate: fromDate, endDate: toDate });
  params.append("populate[]", "class");
  params.append("populate[]", "class.class_type");
  const res = await yogoFetch<unknown>(`class-signups?${params.toString()}`);
  if (!res.ok) return [];
  return Array.isArray(res.data) ? (res.data as YogoSignup[]) : [];
}

// 2h cutoff so the studio can reassign the slot if someone cancels late.
// Yogo's admin UI has no cutoff — Marcelo can still override manually.
const CANCEL_CUTOFF_MS = 2 * 60 * 60 * 1000;

export function isCancellable(signup: YogoSignup, now: Date = new Date()): boolean {
  if (signup.cancelled_at) return false;
  const klass = typeof signup.class === "object" ? signup.class : null;
  if (!klass) return false;
  const start = parseClassStart(klass);
  if (!start) return false;
  return start.getTime() > now.getTime() + CANCEL_CUTOFF_MS;
}

export function parseClassStart(klass: { date?: string; start_time?: string } | null): Date | null {
  if (!klass?.date || !klass?.start_time) return null;
  // Class date+time are tenant-local (Europe/Lisbon for Striker's House); we
  // compare against `new Date()` which is also wall-clock for the server, so
  // for v1 this is good enough. A future refactor can pin to Europe/Lisbon.
  const iso = `${klass.date}T${klass.start_time}:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type DeleteSignupResult = { kind: "ok" } | { kind: "not_found" } | { kind: "server_error"; status: number };

export async function deleteSignup(signupId: number): Promise<DeleteSignupResult> {
  const res = await yogoFetch<unknown>(`class-signups/${signupId}`, { method: "DELETE" });
  if (res.ok) return { kind: "ok" };
  if (res.status === 404) return { kind: "not_found" };
  return { kind: "server_error", status: res.status };
}

export interface UserBooking {
  yogoClassId: number;
  className: string;
  startsAtIso: string;
}

// Returns the user's upcoming group-class bookings within the next 24 hours.
// "Group class" is indicated by seats > 1 (consistent with Task 4's isGroupClass
// pattern). Returns an empty array when the phone isn't found or there are no
// signups in the window.
export async function userBookingsNext24h(phoneE164: string): Promise<UserBooking[]> {
  const customer = await findCustomerByPhone(phoneE164);
  if (!customer) return [];

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const fromDate = now.toISOString().slice(0, 10);  // "YYYY-MM-DD"
  const toDate = in24h.toISOString().slice(0, 10);

  const signups = await listFutureSignups(customer.id, fromDate, toDate);

  const results: UserBooking[] = [];
  for (const signup of signups) {
    if (signup.cancelled_at) continue;
    const klass = typeof signup.class === "object" ? signup.class as YogoClass : null;
    if (!klass) continue;

    // Group class filter: seats > 1
    if (typeof klass.seats === "number" && klass.seats <= 1) continue;

    const start = parseClassStart(klass);
    if (!start) continue;

    // Must be in the next 24h window (start > now AND start <= now+24h)
    if (start.getTime() <= now.getTime()) continue;
    if (start.getTime() > in24h.getTime()) continue;

    const className = klass.class_type?.name ?? "Aula";
    results.push({
      yogoClassId: klass.id,
      className,
      startsAtIso: start.toISOString(),
    });
  }
  return results;
}
