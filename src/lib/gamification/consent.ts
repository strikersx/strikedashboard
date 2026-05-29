import { db } from "@/lib/db";
import { appendEvent } from "./event-log";

/** The 4 consent toggles a user can set. */
export interface ConsentToggles {
  training: boolean;
  ugc: boolean;
  realName: boolean;
  broadcasts: boolean;
}

/**
 * Apply consent toggles for a customer. Records a consent_changed audit event
 * in the event log for every change.
 *
 * Returns the list of toggles that actually changed (diff vs current state).
 */
export async function applyConsent(
  customerId: number,
  toggles: ConsentToggles,
  source: "bot" | "admin" | "system" = "bot",
): Promise<{ changed: string[] }> {
  const identity = await db.gamificationIdentity.findUnique({
    where: { customerId },
  });

  if (!identity) throw new Error(`No identity for customer ${customerId}`);
  if (identity.erasedAt) throw new Error(`Identity ${customerId} is erased`);

  const changed: string[] = [];

  const updates: Record<string, boolean> = {};
  if (toggles.training !== identity.consentTraining) {
    updates.consentTraining = toggles.training;
    changed.push("training");
  }
  if (toggles.ugc !== identity.consentUgc) {
    updates.consentUgc = toggles.ugc;
    changed.push("ugc");
  }
  if (toggles.realName !== identity.consentRealName) {
    updates.consentRealName = toggles.realName;
    changed.push("realName");
  }
  if (toggles.broadcasts !== identity.consentBroadcasts) {
    updates.consentBroadcasts = toggles.broadcasts;
    changed.push("broadcasts");
  }

  if (changed.length > 0) {
    await db.gamificationIdentity.update({
      where: { customerId },
      data: {
        ...updates,
        optInAt: toggles.training ? new Date() : identity.optInAt,
        optOutAt: !toggles.training ? new Date() : identity.optOutAt,
      },
    });

    await appendEvent({
      customerId,
      eventType: "consent_changed",
      payloadJson: { changed, toggles },
      source,
      idempotencyKey: `consent:${customerId}:${Date.now()}`,
    });
  }

  return { changed };
}

/** Check if a customer has opted in (training consent = true). */
export async function isOptedIn(customerId: number): Promise<boolean> {
  const identity = await db.gamificationIdentity.findUnique({
    where: { customerId },
    select: { consentTraining: true, erasedAt: true },
  });
  if (!identity || identity.erasedAt) return false;
  return identity.consentTraining;
}
