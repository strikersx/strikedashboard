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
  const genres = await db.waBlockedGenre.findMany({ orderBy: { addedAt: "desc" } });
  const artists = await db.waBlockedArtist.findMany({ orderBy: { addedAt: "desc" } });
  return NextResponse.json({ genres, artists });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json()) as
    | { type: "genre"; keyword: string; field?: "genre" | "artist" | "track" }
    | { type: "artist"; spotifyArtistId: string; artistName: string; reason?: string };

  if (body.type === "genre") {
    if (!body.keyword || body.keyword.length < 2) {
      return NextResponse.json({ error: "keyword too short" }, { status: 400 });
    }
    const field = body.field ?? "genre";
    if (!["genre", "artist", "track"].includes(field)) {
      return NextResponse.json({ error: "invalid field" }, { status: 400 });
    }
    const created = await db.waBlockedGenre.upsert({
      where: { keyword: body.keyword.toLowerCase() },
      create: { keyword: body.keyword.toLowerCase(), field, addedBy: "admin" },
      update: { field, active: true },
    });
    return NextResponse.json({ ok: true, entry: created });
  }
  if (body.type === "artist") {
    if (!body.spotifyArtistId || !body.artistName) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    const created = await db.waBlockedArtist.upsert({
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
  return NextResponse.json({ error: "invalid type" }, { status: 400 });
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  if (!type || !id) return NextResponse.json({ error: "missing params" }, { status: 400 });

  if (type === "genre") {
    await db.waBlockedGenre.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
  if (type === "artist") {
    await db.waBlockedArtist.delete({ where: { spotifyArtistId: id } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "invalid type" }, { status: 400 });
}
