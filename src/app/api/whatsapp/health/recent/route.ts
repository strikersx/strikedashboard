import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

const PAGE_SIZE = 25;

// GET /api/whatsapp/health/recent — admin-only feed of the most-recent
// inbounds and events. Used by /dashboard/wa as a debug pane so Marcelo
// can see what the bot just did without SSHing into the DB.
export async function GET() {
  const role = await getSession();
  if (role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [inbounds, events, outbounds, sessions] = await Promise.all([
    db.waInbound.findMany({
      orderBy: { receivedAt: "desc" },
      take: PAGE_SIZE,
      select: { id: true, phoneE164: true, body: true, receivedAt: true },
    }),
    db.waEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: { id: true, kind: true, phoneE164: true, meta: true, createdAt: true },
    }),
    db.waOutbound.findMany({
      orderBy: { sentAt: "desc" },
      take: PAGE_SIZE,
      select: { id: true, phoneE164: true, kind: true, status: true, error: true, sentAt: true },
    }),
    db.waSession.findMany({
      orderBy: { updatedAt: "desc" },
      take: PAGE_SIZE,
      select: { phoneE164: true, state: true, pendingClassId: true, pendingSignupId: true, expiresAt: true, version: true, updatedAt: true },
    }),
  ]);

  return NextResponse.json({ inbounds, events, outbounds, sessions });
}
