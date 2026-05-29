import type { YogoMembership, MembershipState } from "./classify";
import { classify } from "./classify";

/**
 * When a customer has multiple memberships, pick the "best" one.
 * Priority: active > dunning > paused > trial > expired > cancelled > unknown.
 *
 * This handles the common case where a student has both an active membership
 * and an expired trial pass.
 */

const STATE_PRIORITY: Record<MembershipState, number> = {
  active: 6,
  dunning: 5,
  paused: 4,
  trial: 3,
  expired: 2,
  cancelled: 1,
  unknown: 0,
};

export function pickBestMembership(
  memberships: YogoMembership[],
  todayISO: string,
): YogoMembership | null {
  if (memberships.length === 0) return null;

  let best: YogoMembership | null = null;
  let bestPriority = -1;

  for (const m of memberships) {
    const state = classify(m, todayISO);
    const priority = STATE_PRIORITY[state];
    if (priority > bestPriority) {
      bestPriority = priority;
      best = m;
    }
  }

  return best;
}
