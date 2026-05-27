// Kill switch. Default ON; only the literal string "false" disables.
// Webhook short-circuits to ack-only when disabled; the dashboard shows a
// banner so admins know the bot is muted.
export function isWaEnabled(): boolean {
  return process.env.WA_ENABLED !== "false";
}

// Per-flow feature flags. Opt-in (must be the literal "true"). Lets us merge
// flow code dark and enable per-environment without redeploying.
export function isReservarEnabled(): boolean {
  return process.env.WA_FLOW_RESERVAR === "true";
}

// Last 6 chars of the production group invite URL path. Set via PR review when
// the WhatsApp group admin rotates the link. Pairs with WA_GROUP_INVITE_URL
// (env) for defence in depth (G4): if env is mis-set in prod, this catches it.
export const INVITE_URL_FINGERPRINT_PROD = "AbCdEf";  // placeholder — set on rollout

// G2 — outbound kill switch. Read at every outbound call site. Set in Vercel
// Production only (not preview, not dev). When false/unset, callers MUST refuse
// to send.
export function isOutboundEnabled(): boolean {
  return process.env.WA_OUTBOUND_ENABLED === "true";
}

export type InviteUrlValidation =
  | { ok: true }
  | { ok: false; reason: "shape" | "fingerprint" };

// G3 + G4 — validate the URL. Shape check accepts a chat.whatsapp.com URL with
// 15-30 path chars and an optional query string (the real link WhatsApp gives
// you carries tracking params like ?s=sw&p=a&mlu=4). Fingerprint check ensures
// the link's path contains the production fingerprint — a defence-in-depth net
// against misconfigured envs.
export function validateInviteUrl(url: string | undefined, fingerprint: string): InviteUrlValidation {
  if (typeof url !== "string" || url.length === 0) return { ok: false, reason: "shape" };
  if (!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{15,30}(\?.*)?$/.test(url)) {
    return { ok: false, reason: "shape" };
  }
  if (!url.includes(fingerprint)) return { ok: false, reason: "fingerprint" };
  return { ok: true };
}
