import { yogoFetch } from "@/lib/yogo/fetch";

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
  return Array.isArray(res.data) ? (res.data as YogoClass[]) : [];
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

// 15min cutoff guards against cancellations after a class has effectively
// started — Yogo would still accept, but the student loses the paid slot.
const CANCEL_CUTOFF_MS = 15 * 60 * 1000;

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
