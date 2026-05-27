import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const role = await getSession();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const artists = await db.waAllowedArtist.findMany({ orderBy: { addedAt: "desc" } });
  return NextResponse.json({ artists });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json()) as {
    spotifyArtistId: string;
    artistName: string;
    reason?: string;
  };

  if (!body.spotifyArtistId || !body.artistName) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const created = await db.waAllowedArtist.upsert({
    where: { spotifyArtistId: body.spotifyArtistId },
    create: {
      spotifyArtistId: body.spotifyArtistId,
      artistName: body.artistName,
      reason: body.reason ?? null,
      addedBy: "admin",
    },
    update: { artistName: body.artistName, reason: body.reason ?? null },
  });
  return NextResponse.json({ ok: true, entry: created });
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await db.waAllowedArtist.delete({ where: { spotifyArtistId: id } });
  return NextResponse.json({ ok: true });
}
