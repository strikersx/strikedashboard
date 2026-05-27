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
    else if (d.outcome === "dry") summary.dry++;
  }
  return summary;
}
