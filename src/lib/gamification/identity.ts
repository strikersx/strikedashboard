import { db } from "@/lib/db";
import type { IdentityInput } from "./types";

/**
 * Identity resolution for StrikeLab gamification.
 *
 * Links Yogo customer_id ↔ phone (E.164) ↔ email ↔ WhatsApp WA ID ↔ optional verified IG.
 * All lookups go through GamificationIdentity, which is the single junction table.
 */

/** Normalise email: lowercase + trim. Gmail dot-stripping NOT applied (too risky). */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ─── Upsert ──────────────────────────────────────────────────────────

/** Create or update an identity row. Returns the upserted row. */
export async function upsertIdentity(input: IdentityInput) {
  return db.gamificationIdentity.upsert({
    where: { customerId: input.customerId },
    update: {
      ...(input.phoneE164 && { phoneE164: input.phoneE164 }),
      ...(input.email && { email: normalizeEmail(input.email) }),
      ...(input.whatsappWaId && { whatsappWaId: input.whatsappWaId }),
    },
    create: {
      customerId: input.customerId,
      phoneE164: input.phoneE164,
      email: input.email ? normalizeEmail(input.email) : null,
      whatsappWaId: input.whatsappWaId ?? null,
    },
  });
}

// ─── Lookups ─────────────────────────────────────────────────────────

export async function findByPhone(phoneE164: string) {
  return db.gamificationIdentity.findUnique({ where: { phoneE164 } });
}

export async function findByEmail(email: string) {
  return db.gamificationIdentity.findUnique({
    where: { email: normalizeEmail(email) },
  });
}

export async function findByWaId(whatsappWaId: string) {
  return db.gamificationIdentity.findUnique({ where: { whatsappWaId } });
}

export async function findByCustomerId(customerId: number) {
  return db.gamificationIdentity.findUnique({ where: { customerId } });
}

// ─── IG verification ─────────────────────────────────────────────────

/** Generate a 6-digit challenge code and store it with 30-min expiry. */
export async function generateIgChallenge(customerId: number): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiry = new Date(Date.now() + 30 * 60 * 1000);

  await db.gamificationIdentity.update({
    where: { customerId },
    data: { igChallengeCode: code, igChallengeExpiry: expiry },
  });

  return code;
}

/** Verify the challenge code and set the IG handle. */
export async function verifyIgChallenge(input: {
  customerId: number;
  code: string;
  igHandle: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const identity = await db.gamificationIdentity.findUnique({
    where: { customerId: input.customerId },
  });

  if (!identity) return { ok: false, reason: "identity_not_found" };
  if (identity.erasedAt) return { ok: false, reason: "erased" };
  if (identity.igChallengeCode !== input.code) {
    return { ok: false, reason: "code_mismatch" };
  }
  if (!identity.igChallengeExpiry || identity.igChallengeExpiry < new Date()) {
    return { ok: false, reason: "code_expired" };
  }

  await db.gamificationIdentity.update({
    where: { customerId: input.customerId },
    data: {
      instagramHandle: input.igHandle,
      igVerifiedAt: new Date(),
      igChallengeCode: null,
      igChallengeExpiry: null,
    },
  });

  return { ok: true };
}
