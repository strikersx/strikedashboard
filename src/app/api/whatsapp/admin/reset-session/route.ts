import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST /api/whatsapp/admin/reset-session — admin-only "kick stuck user" knob.
// Forces the WaSession for a given phoneE164 back to IDLE so the user can
// re-enter the funnel with `reserva` / `cancelar`. Version bumps so any
// in-flight transition from the prior state will lose the race and fall
// silently into SESSION_RACE.
export async function POST(req: NextRequest) {
  const role = await getSession();
  if (role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { phoneE164?: unknown };
  try {
    body = (await req.json()) as { phoneE164?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const phoneE164 = body.phoneE164;
  if (typeof phoneE164 !== "string" || !phoneE164.startsWith("+")) {
    return NextResponse.json({ error: "phoneE164 must be E.164 string starting with '+'" }, { status: 400 });
  }

  const result = await db.waSession.updateMany({
    where: { phoneE164 },
    data: {
      state: "IDLE",
      pendingClassId: null,
      pendingSignupId: null,
      expiresAt: null,
      version: { increment: 1 },
    },
  });

  await db.waEvent
    .create({
      data: {
        kind: "ADMIN_RESET",
        phoneE164,
        meta: JSON.stringify({ rowsUpdated: result.count }),
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, updated: result.count });
}
