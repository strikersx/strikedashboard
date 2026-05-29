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
      allowlistedArtistId?: string;
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

// Strip diacritics so "axé" matches "axe music", "modão" matches "modao", etc.
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export async function evaluateTrack(trackId: string): Promise<EvaluateResult> {
  const trackRes = await spotifyFetch(`/v1/tracks/${trackId}`);
  if (!trackRes.ok) throw new Error(`Track lookup failed: ${trackRes.status}`);
  const track = (await trackRes.json()) as SpotifyTrack;
  const artistIds = track.artists.map((a) => a.id);
  const primaryArtistName = track.artists[0]?.name ?? "Unknown";

  // Block first (precise artist ID match)
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

  // Allowlist short-circuits keyword filter (e.g. "Poesia Acústica" must not be
  // caught by "acoustic" / "acústico" keywords)
  const artistAllows = await db.waAllowedArtist.findMany({
    where: { spotifyArtistId: { in: artistIds } },
  });

  // Spotify deprecated the batch endpoint GET /v1/artists?ids= for new apps
  // (returns 403 Forbidden, same pattern as /playlists/{id}/tracks → /items).
  // Fetch each artist individually; genres may be empty in Development Mode.
  const artistDetails: SpotifyArtist[] = [];
  for (const aid of artistIds) {
    const ar = await spotifyFetch(`/v1/artists/${aid}`);
    if (ar.ok) {
      artistDetails.push((await ar.json()) as SpotifyArtist);
    }
  }
  const resolvedPrimaryName = artistDetails[0]?.name ?? primaryArtistName;

  if (artistAllows.length > 0) {
    return {
      outcome: "accept",
      trackId: track.id,
      trackName: track.name,
      trackUri: track.uri,
      artistName: resolvedPrimaryName,
      artistIds,
      allowlistedArtistId: artistAllows[0].spotifyArtistId,
    };
  }

  const allGenres = artistDetails.flatMap((a) => (a.genres ?? []).map(norm));
  const allArtistNames = artistDetails.map((a) => norm(a.name ?? ""));
  const trackNameNorm = norm(track.name ?? "");

  const blocked = await db.waBlockedGenre.findMany({ where: { active: true } });

  // Field-scoped match: each keyword is tested ONLY against the Spotify field it
  // was registered for. This prevents a genre keyword (e.g. "sleep") from killing
  // a track named "Sleepless", or an artist keyword ("adele") from matching the
  // track title "Madeleine". Legacy rows default to "genre".
  for (const b of blocked) {
    const kw = norm(b.keyword);
    const field = b.field ?? "genre";

    if (field === "genre" && allGenres.some((g) => g.includes(kw))) {
      return {
        outcome: "reject_genre",
        matchedKeyword: b.keyword,
        matchedAgainst: "genre",
        trackName: track.name,
        artistName: resolvedPrimaryName,
      };
    }
    if (field === "artist" && allArtistNames.some((n) => n.includes(kw))) {
      return {
        outcome: "reject_genre",
        matchedKeyword: b.keyword,
        matchedAgainst: "artist_name",
        trackName: track.name,
        artistName: resolvedPrimaryName,
      };
    }
    if (field === "track" && trackNameNorm.includes(kw)) {
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
