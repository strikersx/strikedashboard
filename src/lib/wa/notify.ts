import { db } from "@/lib/db";
import { sendText } from "@/lib/wa/meta";

// notifyAdmin sends an OOB advisory message to the admin's WhatsApp.
// Used for batch-start / batch-fail / config-anomaly alerts (G13).
//
// Contract: never throws. Internal failures (missing env, Meta error)
// are logged to WaEvent as OOB_NOTIFY_FAIL and swallowed so caller flow
// continues. Successful sends log OOB_NOTIFY_OK.
export async function notifyAdmin(message: string, kind: string): Promise<void> {
  const recipient = process.env.RICARDO_PHONE_E164;
  if (!recipient) {
    await safeLogEvent("OOB_NOTIFY_FAIL", null, { kind, reason: "missing_env" });
    return;
  }

  try {
    const result = await sendText(recipient, message);
    if (result.ok) {
      await safeLogEvent("OOB_NOTIFY_OK", recipient, { kind });
    } else {
      await safeLogEvent("OOB_NOTIFY_FAIL", recipient, { kind, status: result.status, body: snippet(result.body) });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await safeLogEvent("OOB_NOTIFY_FAIL", recipient, { kind, error: msg });
  }
}

async function safeLogEvent(kind: string, phoneE164: string | null, meta: Record<string, unknown>): Promise<void> {
  try {
    await db.waEvent.create({ data: { kind, phoneE164, meta: JSON.stringify(meta) } });
  } catch {
    // Logging failure is non-actionable here; swallow.
  }
}

function snippet(s: string): string {
  return s.length <= 200 ? s : s.slice(0, 200);
}
