import { db } from "@/lib/db";
import { spotifyFetch } from "@/lib/spotify/client";
import { loadRefreshToken } from "@/lib/spotify/token-store";

export interface CreateClassPlaylistArgs {
  yogoClassId: number;
  className: string;
  startsAtIso: string;
}

export interface CreateClassPlaylistResult {
  spotifyPlaylistId: string;
  created: boolean;
}

function formatPlaylistName(args: CreateClassPlaylistArgs): string {
  const d = new Date(args.startsAtIso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `SH - ${args.className} ${hh}:${mm} - ${dd}/${mo}`;
}

// Read playlist content via the /items endpoint — Spotify deprecated /tracks
// for new Web API apps (returns 403 Forbidden). The /items endpoint is the
// unified replacement that supports both tracks AND episodes; filter to track.
async function fetchAllBaseTracks(): Promise<string[]> {
  const baseId = process.env.SPOTIFY_BASE_PLAYLIST_ID;
  if (!baseId) throw new Error("SPOTIFY_BASE_PLAYLIST_ID not set");
  const uris: string[] = [];
  let url: string | null = `/v1/playlists/${baseId}/items?fields=items(item(uri,type)),next&limit=100`;
  while (url) {
    const res = await spotifyFetch(url);
    if (!res.ok) throw new Error(`Failed to read base playlist: ${res.status}`);
    const data = (await res.json()) as {
      items: Array<{ item: { uri: string; type: string } | null }>;
      next: string | null;
    };
    for (const it of data.items) {
      if (it.item?.uri && it.item.type === "track") uris.push(it.item.uri);
    }
    url = data.next;
  }
  return uris;
}

function shuffleTake<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export async function createClassPlaylist(
  args: CreateClassPlaylistArgs
): Promise<CreateClassPlaylistResult> {
  const existing = await db.waClassPlaylist.findUnique({
    where: { yogoClassId: args.yogoClassId },
  });
  if (existing) {
    return { spotifyPlaylistId: existing.spotifyPlaylistId, created: false };
  }

  const stored = await loadRefreshToken();
  if (!stored) throw new Error("Spotify not authenticated");

  // Use POST /me/playlists, NOT /users/{user_id}/playlists — the latter
  // returns 403 "Forbidden" in Development Mode even for the app owner.
  const createRes = await spotifyFetch(`/v1/me/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name: formatPlaylistName(args),
      public: true,
      description: `Auto-generated playlist for Strike's House class ${args.className}`,
    }),
  });
  if (!createRes.ok) throw new Error(`Spotify create playlist failed: ${createRes.status}`);
  const created = (await createRes.json()) as { id: string };

  const baseUris = await fetchAllBaseTracks();
  const seedUris = shuffleTake(baseUris, 20);

  if (seedUris.length > 0) {
    const addRes = await spotifyFetch(`/v1/playlists/${created.id}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: seedUris, position: 0 }),
    });
    if (!addRes.ok) throw new Error(`Spotify add tracks failed: ${addRes.status}`);
  }

  await db.waClassPlaylist.create({
    data: { yogoClassId: args.yogoClassId, spotifyPlaylistId: created.id },
  });

  return { spotifyPlaylistId: created.id, created: true };
}

export interface InsertSongArgs {
  yogoClassId: number;
  trackUri: string;
}

export interface InsertSongResult {
  position: number;
}

export async function insertSongAtNextPosition(args: InsertSongArgs): Promise<InsertSongResult> {
  const playlist = await db.$transaction(async (tx) => {
    return tx.waClassPlaylist.update({
      where: { yogoClassId: args.yogoClassId },
      data: { requestCount: { increment: 1 } },
    });
  });
  const position = playlist.requestCount - 1;

  const res = await spotifyFetch(`/v1/playlists/${playlist.spotifyPlaylistId}/items`, {
    method: "POST",
    body: JSON.stringify({ uris: [args.trackUri], position }),
  });
  if (!res.ok) {
    await db.waClassPlaylist.update({
      where: { yogoClassId: args.yogoClassId },
      data: { requestCount: { decrement: 1 } },
    });
    throw new Error(`Spotify add track failed: ${res.status}`);
  }

  return { position };
}

export async function removeSongAndRecompress(songRequestId: string): Promise<void> {
  const req = await db.waSongRequest.findUnique({ where: { id: songRequestId } });
  if (!req || req.status !== "active") return;

  const playlist = await db.waClassPlaylist.findUnique({
    where: { yogoClassId: req.yogoClassId },
  });
  if (!playlist) return;

  // DELETE on /items uses body { items: [{ uri }] } — distinct from the legacy
  // /tracks endpoint which used { tracks: [{ uri }] }.
  const res = await spotifyFetch(`/v1/playlists/${playlist.spotifyPlaylistId}/items`, {
    method: "DELETE",
    body: JSON.stringify({ items: [{ uri: req.spotifyTrackUri }] }),
  });
  if (!res.ok) throw new Error(`Spotify delete failed: ${res.status}`);

  await db.$transaction([
    db.waSongRequest.update({
      where: { id: songRequestId },
      data: { status: "cancelled_by_unbook" },
    }),
    db.waSongRequest.updateMany({
      where: {
        yogoClassId: req.yogoClassId,
        status: "active",
        position: { gt: req.position },
      },
      data: { position: { decrement: 1 } },
    }),
    db.waClassPlaylist.update({
      where: { yogoClassId: req.yogoClassId },
      data: { requestCount: { decrement: 1 } },
    }),
  ]);
}

export interface SwapSongArgs {
  oldRequestId: string;
  newTrackUri: string;
  newTrackId: string;
  newTrackName: string;
  newArtistName: string;
  contactId: string;
}

export async function swapSong(args: SwapSongArgs): Promise<{ position: number; newRequestId: string }> {
  const old = await db.waSongRequest.findUnique({ where: { id: args.oldRequestId } });
  if (!old || old.status !== "active") throw new Error("old request not active");
  const playlist = await db.waClassPlaylist.findUnique({
    where: { yogoClassId: old.yogoClassId },
  });
  if (!playlist) throw new Error("no playlist");

  const delRes = await spotifyFetch(`/v1/playlists/${playlist.spotifyPlaylistId}/items`, {
    method: "DELETE",
    body: JSON.stringify({ items: [{ uri: old.spotifyTrackUri }] }),
  });
  if (!delRes.ok) throw new Error(`Spotify delete failed: ${delRes.status}`);

  const addRes = await spotifyFetch(`/v1/playlists/${playlist.spotifyPlaylistId}/items`, {
    method: "POST",
    body: JSON.stringify({ uris: [args.newTrackUri], position: old.position }),
  });
  if (!addRes.ok) throw new Error(`Spotify insert failed: ${addRes.status}`);

  const [, fresh] = await db.$transaction([
    db.waSongRequest.update({
      where: { id: args.oldRequestId },
      data: { status: "swapped" },
    }),
    db.waSongRequest.create({
      data: {
        contactId: args.contactId,
        yogoClassId: old.yogoClassId,
        spotifyTrackId: args.newTrackId,
        spotifyTrackName: args.newTrackName,
        spotifyArtistName: args.newArtistName,
        spotifyTrackUri: args.newTrackUri,
        position: old.position,
        status: "active",
      },
    }),
  ]);

  return { position: old.position, newRequestId: fresh.id };
}
