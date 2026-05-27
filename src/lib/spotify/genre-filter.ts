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
      matchedAgainst: "genre" | "artist_name" | "track_name";
      trackName: string;
      artistName: string;
    }
  | {
      outcome: "reject_artist";
      blockedArtistId: string;
      blockedArtistName: string;
      trackName: string;
      artistName: string;
    }
  | {
      outcome: "reject_explicit";
      trackName: string;
      artistName: string;
    };

interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  explicit: boolean;
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

  // Reject explicit content outright (Marcelo opens at the gym; no explicit lyrics in class)
  if (track.explicit) {
    return {
      outcome: "reject_explicit",
      trackName: track.name,
      artistName: primaryArtistName,
    };
  }

  // Check artist ID blocklist first (precise)
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

  // Fetch full artist objects (genres + canonical names)
  const artistsRes = await spotifyFetch(`/v1/artists?ids=${artistIds.join(",")}`);
  if (!artistsRes.ok) throw new Error(`Artist lookup failed: ${artistsRes.status}`);
  const artistsBody = (await artistsRes.json()) as { artists: SpotifyArtist[] };
  const resolvedPrimaryName = artistsBody.artists[0]?.name ?? primaryArtistName;

  const allGenres = artistsBody.artists.flatMap((a) => a.genres.map((g) => g.toLowerCase()));
  const allArtistNames = artistsBody.artists.map((a) => (a.name ?? "").toLowerCase());
  const trackNameLower = (track.name ?? "").toLowerCase();

  // Load active keyword blocklist once
  const blocked = await db.waBlockedGenre.findMany({ where: { active: true } });

  // Match keyword against any of: artist genres, artist names, track name
  for (const b of blocked) {
    const kw = b.keyword.toLowerCase();
    if (allGenres.some((g) => g.includes(kw))) {
      return {
        outcome: "reject_genre",
        matchedKeyword: b.keyword,
        matchedAgainst: "genre",
        trackName: track.name,
        artistName: resolvedPrimaryName,
      };
    }
    if (allArtistNames.some((n) => n.includes(kw))) {
      return {
        outcome: "reject_genre",
        matchedKeyword: b.keyword,
        matchedAgainst: "artist_name",
        trackName: track.name,
        artistName: resolvedPrimaryName,
      };
    }
    if (trackNameLower.includes(kw)) {
      return {
        outcome: "reject_genre",
        matchedKeyword: b.keyword,
        matchedAgainst: "track_name",
        trackName: track.name,
        artistName: resolvedPrimaryName,
      };
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
