/**
 * classify() — determine the true state of a Yogo membership.
 *
 * Yogo's `status` field is unreliable (shows "active" even during dunning).
 * This function cross-references `status`, `status_text`, `paid_until`,
 * and the current date to produce the REAL state.
 *
 * Canonical recipe from yogo-booking-api skill.
 *
 * Returns one of 7 states:
 *   "active"     — paying, no issues
 *   "dunning"    — renewal failing (N attempts)
 *   "paused"     — explicitly paused OR dunning-induced pause
 *   "cancelled"  — membership ended
 *   "expired"    — paid_until in the past, no active renewal
 *   "trial"      — class pass (not a recurring membership)
 *   "unknown"    — can't determine
 */

export interface YogoMembership {
  status: string;
  status_text: string;
  paid_until: string | null;
  next_payment?: { date: string | null };
  membership_type?: { id: number; name: string };
}

export type MembershipState =
  | "active"
  | "dunning"
  | "paused"
  | "cancelled"
  | "expired"
  | "trial"
  | "unknown";

export function classify(m: YogoMembership, todayISO: string): MembershipState {
  // 1. Cancelled overrides everything
  if (m.status === "ended") return "cancelled";

  // 2. Dunning detection — regex on status_text
  //    Real case: "Pausado. Renovação automática falhou 4 vezes."
  const dunningPattern = /falhou|Pausado.*falhou/i;
  if (dunningPattern.test(m.status_text)) {
    // Check if it's actually paused (dunning pause) vs just failing
    if (/pausado/i.test(m.status_text)) return "paused";
    return "dunning";
  }

  // 3. Paused (explicit)
  if (/pausado/i.test(m.status_text)) return "paused";

  // 4. Trial — class pass type (detected by membership_type name)
  //    Must come before active check: a class pass with active status is still a trial.
  if (m.membership_type?.name?.toLowerCase().includes("pass")) return "trial";

  // 5. Expired — paid_until in the past
  if (m.paid_until) {
    const paidUntil = m.paid_until.substring(0, 10); // "YYYY-MM-DD"
    if (paidUntil < todayISO) return "expired";
  }

  // 6. Active — status is "active" and paid_until is in the future
  if (m.status === "active") return "active";

  return "unknown";
}
