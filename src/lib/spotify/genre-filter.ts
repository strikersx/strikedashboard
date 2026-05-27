import { db } from "@/lib/db";
import { spotifyFetch } from "@/lib/spotify/client";

export type EvaluateResult =
  | {
      outcome: "accept";
      trackId: string;
      trackName: string;
      trackUri: string;
      artistName: string;
      artistIds: string[];
    }
  | {
      outcome: "reject_genre";
      matchedKeyword: string;
      trackName: string;
      artistName: string;
    }
  | {
      outcome: "reject_artist";
      blockedArtistId: string;
      blockedArtistName: string;
      trackName: string;
      artistName: string;
    };

interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: Array<{ id: string; name?: string }>;
}

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
}

export async function evaluateTrack(trackId: string): Promise<EvaluateResult> {
  const trackRes = await spotifyFetch(`/v1/tracks/${trackId}`);
  if (!trackRes.ok) throw new Error(`Track lookup failed: ${trackRes.status}`);
  const track = (await trackRes.json()) as SpotifyTrack;
  const artistIds = track.artists.map((a) => a.id);
  const primaryArtistName = track.artists[0]?.name ?? "Unknown";

  // Check artist blocklist first
  const artistBlocks = await db.waBlockedArtist.findMany({
    where: { spotifyArtistId: { in: artistIds } },
  });
  if (artistBlocks.length > 0) {
    return {
      outcome: "reject_artist",
      blockedArtistId: artistBlocks[0].spotifyArtistId,
      blockedArtistName: artistBlocks[0].artistName,
      trackName: track.name,
      artistName: primaryArtistName,
    };
  }

  // Fetch all artists in one batched call
  const artistsRes = await spotifyFetch(`/v1/artists?ids=${artistIds.join(",")}`);
  if (!artistsRes.ok) throw new Error(`Artist lookup failed: ${artistsRes.status}`);
  const artistsBody = (await artistsRes.json()) as { artists: SpotifyArtist[] };

  // Prefer the name from the full artist object (more reliable than track.artists[*].name)
  const resolvedPrimaryName =
    artistsBody.artists[0]?.name ?? primaryArtistName;

  const allGenres = artistsBody.artists.flatMap((a) => a.genres.map((g) => g.toLowerCase()));

  if (allGenres.length > 0) {
    const blocked = await db.waBlockedGenre.findMany({ where: { active: true } });
    for (const b of blocked) {
      const kw = b.keyword.toLowerCase();
      if (allGenres.some((g) => g.includes(kw))) {
        return {
          outcome: "reject_genre",
          matchedKeyword: b.keyword,
          trackName: track.name,
          artistName: resolvedPrimaryName,
        };
      }
    }
  }

  return {
    outcome: "accept",
    trackId: track.id,
    trackName: track.name,
    trackUri: track.uri,
    artistName: resolvedPrimaryName,
    artistIds,
  };
}
