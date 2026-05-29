import { db } from "@/lib/db";
import type { AppendEventInput, AppendEventResult } from "./types";

/**
 * Append a single event to the immutable gamification_event_log.
 *
 * Idempotent: if a row with the same `idempotencyKey` already exists,
 * Prisma throws P2002 (unique constraint) and we return { written: false }.
 *
 * The `eventId` is a monotonically-increasing integer managed by SQLite
 * autoincrement. Callers should not set it.
 */
export async function appendEvent(input: AppendEventInput): Promise<AppendEventResult> {
  try {
    // Get the current max eventId to compute the next one.
    // This is safe for single-writer (cron) usage.
    const maxRow = await db.gamificationEventLog.findFirst({
      orderBy: { eventId: "desc" },
      select: { eventId: true },
    });
    const nextEventId = (maxRow?.eventId ?? 0) + 1;

    const row = await db.gamificationEventLog.create({
      data: {
        eventId: nextEventId,
        customerId: input.customerId,
        eventType: input.eventType,
        pointsDelta: input.pointsDelta ?? 0,
        xpDelta: input.xpDelta ?? 0,
        payloadJson: input.payloadJson ? JSON.stringify(input.payloadJson) : null,
        source: input.source ?? "system",
        operatorId: input.operatorId ?? null,
        idempotencyKey: input.idempotencyKey,
        pointsPeriod: input.pointsPeriod ?? null,
      },
      select: { eventId: true },
    });

    return { written: true, eventId: row.eventId };
  } catch (err: unknown) {
    // P2002 = unique constraint violation → duplicate idempotencyKey
    if (isP2002(err)) {
      return { written: false };
    }
    throw err;
  }
}

/** Type guard for Prisma P2002 unique-constraint error. */
function isP2002(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code: string }).code === "P2002";
  }
  return false;
}
