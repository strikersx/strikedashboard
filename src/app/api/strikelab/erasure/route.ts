import { NextRequest, NextResponse } from "next/server";
import { executeTrackA, executeTrackB } from "@/lib/gamification/erasure";

/**
 * POST /api/strikelab/erasure
 *
 * Admin-only endpoint for GDPR Art. 17 erasure.
 * Body: { customerId: number, track: "A" | "B" }
 *
 * Track A: pseudonymise (tombstone + anonymise + zero)
 * Track B: full delete (≥12 months after Track A)
 */
export async function POST(req: NextRequest) {
  // Admin auth check — same cookie-based auth as dashboard
  const cookie = req.cookies.get("session");
  if (!cookie?.value) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { customerId, track } = body;

    if (typeof customerId !== "number" || !["A", "B"].includes(track)) {
      return NextResponse.json(
        { error: "Invalid request. Required: customerId (number), track ('A' or 'B')" },
        { status: 400 },
      );
    }

    if (track === "A") {
      const result = await executeTrackA(customerId, customerId);
      return NextResponse.json(result);
    }

    const result = await executeTrackB(customerId, customerId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
