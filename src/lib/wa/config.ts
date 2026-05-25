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

export function isCancelarEnabled(): boolean {
  return process.env.WA_FLOW_CANCELAR === "true";
}
