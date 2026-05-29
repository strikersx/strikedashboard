import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/strikelab/admin/pause
 *
 * Admin-only. Set/clear pause flags on a student identity.
 * Body: { customerId: number, medicalPauseUntil?: string, vacationPauseUntil?: string, personalPauseUntil?: string }
 * Send null to clear a flag.
 */
export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("session");
  if (!cookie?.value) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { customerId, medicalPauseUntil, vacationPauseUntil, personalPauseUntil } = body;

    if (typeof customerId !== "number") {
      return NextResponse.json({ error: "Required: customerId (number)" }, { status: 400 });
    }

    const data: Record<string, Date | null> = {};
    if (medicalPauseUntil !== undefined) {
      data.medicalPauseUntil = medicalPauseUntil ? new Date(medicalPauseUntil) : null;
    }
    if (vacationPauseUntil !== undefined) {
      data.vacationPauseUntil = vacationPauseUntil ? new Date(vacationPauseUntil) : null;
    }
    if (personalPauseUntil !== undefined) {
      data.personalPauseUntil = personalPauseUntil ? new Date(personalPauseUntil) : null;
    }

    const identity = await db.gamificationIdentity.update({
      where: { customerId },
      data,
    });

    return NextResponse.json({
      customerId: identity.customerId,
      medicalPauseUntil: identity.medicalPauseUntil,
      vacationPauseUntil: identity.vacationPauseUntil,
      personalPauseUntil: identity.personalPauseUntil,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
