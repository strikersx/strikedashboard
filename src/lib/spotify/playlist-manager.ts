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

async function fetchAllBaseTracks(): Promise<string[]> {
  const baseId = process.env.SPOTIFY_BASE_PLAYLIST_ID;
  if (!baseId) throw new Error("SPOTIFY_BASE_PLAYLIST_ID not set");
  const uris: string[] = [];
  let url: string | null = `/v1/playlists/${baseId}/tracks?fields=items(track(uri)),next&limit=100`;
  while (url) {
    const res = await spotifyFetch(url);
    if (!res.ok) throw new Error(`Failed to read base playlist: ${res.status}`);
    const data = (await res.json()) as {
      items: Array<{ track: { uri: string } | null }>;
      next: string | null;
    };
    for (const item of data.items) {
      if (item.track?.uri) uris.push(item.track.uri);
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

  const createRes = await spotifyFetch(`/v1/users/${stored.spotifyUserId}/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name: formatPlaylistName(args),
      public: false,
      description: `Auto-generated playlist for Strike's House class ${args.className}`,
    }),
  });
  if (!createRes.ok) throw new Error(`Spotify create playlist failed: ${createRes.status}`);
  const created = (await createRes.json()) as { id: string };

  const baseUris = await fetchAllBaseTracks();
  const seedUris = shuffleTake(baseUris, 20);

  if (seedUris.length > 0) {
    const addRes = await spotifyFetch(`/v1/playlists/${created.id}/tracks`, {
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
