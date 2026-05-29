/**
 * Filter out non-actionable "leads" — aggregator accounts and internal test users.
 *
 * These are NOT real people and should never appear in gamification.
 * Canonical recipe from yogo-booking-api skill.
 */

const AGGREGATOR_PATTERNS = [
  /usc-.*@urbansportsclub\.com/i,
  /@strikershouse\./i,
  /@classpass\./i,
  /@bruceapp\./i,
];

export function isNonActionableLead(email: string | null | undefined): boolean {
  if (!email) return false; // no email = can't filter, let through
  return AGGREGATOR_PATTERNS.some((p) => p.test(email));
}
