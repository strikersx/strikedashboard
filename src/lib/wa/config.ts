// Kill switch. Default ON; only the literal string "false" disables.
// Webhook short-circuits to ack-only when disabled; the dashboard shows a
// banner so admins know the bot is muted.
export function isWaEnabled(): boolean {
  return process.env.WA_ENABLED !== "false";
}
