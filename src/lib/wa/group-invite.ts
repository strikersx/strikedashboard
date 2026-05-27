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
