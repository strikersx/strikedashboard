import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isWaEnabled } from "@/lib/wa/config";

// GET /api/whatsapp/health — admin-only snapshot of bot state.
// Returns last-24h WaEvent counts grouped by kind, WaSession active/expired
// counts, and recent outbound failures.
export async function GET() {
  const role = await getSession();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [eventsRaw, activeSessions, expiredSessions, outboundFailedRaw] = await Promise.all([
    db.waEvent.groupBy({
      by: ["kind"],
      where: { createdAt: { gte: since } },
      _count: { kind: true },
    }),
    db.waSession.count({ where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    db.waSession.count({ where: { expiresAt: { lte: now } } }),
    db.waOutbound.count({ where: { status: "failed", sentAt: { gte: since } } }),
  ]);

  const last24hByKind: Record<string, number> = {};
  for (const row of eventsRaw) {
    last24hByKind[row.kind] = row._count.kind;
  }

  return NextResponse.json({
    enabled: isWaEnabled(),
    generatedAt: now.toISOString(),
    last24h: {
      eventsByKind: last24hByKind,
      outboundFailed: outboundFailedRaw,
    },
    sessions: {
      active: activeSessions,
      expired: expiredSessions,
    },
  });
}
