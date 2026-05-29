import { NextRequest, NextResponse } from "next/server";
import { appendEvent } from "@/lib/gamification/event-log";
import { getCurrentPeriod } from "@/lib/gamification/poll/shared";

/**
 * POST /api/strikelab/admin/adjust-points
 *
 * Admin-only. Manual points adjustment.
 * Body: { customerId: number, pointsDelta: number, reason: string }
 */
export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("session");
  if (!cookie?.value) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { customerId, pointsDelta, reason } = body;

    if (typeof customerId !== "number" || typeof pointsDelta !== "number" || !reason) {
      return NextResponse.json(
        { error: "Required: customerId (number), pointsDelta (number), reason (string)" },
        { status: 400 },
      );
    }

    const result = await appendEvent({
      customerId,
      eventType: "manual_points_adjust",
      pointsDelta,
      xpDelta: 0,
      payloadJson: { reason, operatorAction: true },
      source: "admin",
      idempotencyKey: `manual_adjust:${customerId}:${Date.now()}`,
      pointsPeriod: getCurrentPeriod(),
    });

    return NextResponse.json({ written: result.written, eventId: result.eventId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
