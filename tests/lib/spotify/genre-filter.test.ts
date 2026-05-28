import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks – must be defined before any vi.mock() factory runs
// ---------------------------------------------------------------------------
const {
  genreDeleteManyMock,
  genreCreateMock,
  genreFindManyMock,
  artistDeleteManyMock,
  artistCreateMock,
  artistFindManyMock,
  allowedArtistFindManyMock,
  spotifyFindUniqueMock,
  spotifyUpsertMock,
} = vi.hoisted(() => ({
  genreDeleteManyMock: vi.fn(),
  genreCreateMock: vi.fn(),
  genreFindManyMock: vi.fn(),
  artistDeleteManyMock: vi.fn(),
  artistCreateMock: vi.fn(),
  artistFindManyMock: vi.fn(),
  allowedArtistFindManyMock: vi.fn(),
  spotifyFindUniqueMock: vi.fn(),
  spotifyUpsertMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    waBlockedGenre: {
      deleteMany: genreDeleteManyMock,
      create: genreCreateMock,
      findMany: genreFindManyMock,
    },
    waBlockedArtist: {
      deleteMany: artistDeleteManyMock,
      create: artistCreateMock,
      findMany: artistFindManyMock,
    },
    waAllowedArtist: {
      findMany: allowedArtistFindManyMock,
    },
    spotifyToken: {
      findUnique: spotifyFindUniqueMock,
      upsert: spotifyUpsertMock,
    },
  },
}));

import { evaluateTrack } from "@/lib/spotify/genre-filter";
import { __resetTokenCacheForTests } from "@/lib/spotify/client";
import { encryptToken } from "@/lib/spotify/token-store";

describe("evaluateTrack", () => {
  beforeEach(() => {
    genreDeleteManyMock.mockReset();
    genreCreateMock.mockReset();
    genreFindManyMock.mockReset();
    artistDeleteManyMock.mockReset();
    artistCreateMock.mockReset();
    artistFindManyMock.mockReset();
    allowedArtistFindManyMock.mockReset();
    spotifyFindUniqueMock.mockReset();
    spotifyUpsertMock.mockReset();
    __resetTokenCacheForTests();

    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.SPOTIFY_CLIENT_ID = "cid";
    process.env.SPOTIFY_CLIENT_SECRET = "csec";

    // Default: no blocked artists, no allowed artists
    artistFindManyMock.mockResolvedValue([]);
    allowedArtistFindManyMock.mockResolvedValue([]);

    // Default: token available
    const enc = encryptToken("rt");
    spotifyFindUniqueMock.mockResolvedValue({
      ...enc,
      spotifyUserId: "u1",
      scope: "playlist-modify-public",
    });

    vi.restoreAllMocks();
  });

  function mockSpotify(
    track: { id: string; name: string; uri: string; explicit?: boolean; artists: Array<{ id: string; name?: string }> },
    artists: Record<string, { genres: string[]; name: string }>
  ) {
    const enc = encryptToken("rt");
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("accounts.spotify.com")) {
        return new Response(
          JSON.stringify({ access_token: "t", expires_in: 3600 }),
          { status: 200 }
        );
      }
      if (url.includes("/v1/tracks/")) {
        return new Response(JSON.stringify(track), { status: 200 });
      }
      if (url.includes("/v1/artists?ids=")) {
        const ids = new URL(url).searchParams.get("ids")!.split(",");
        return new Response(
          JSON.stringify({ artists: ids.map((id) => ({ id, ...artists[id] })) }),
          { status: 200 }
        );
      }
      return new Response("nope", { status: 500 });
    }) as unknown as typeof fetch;

    // Re-seed the spotifyFindUnique mock after vi.restoreAllMocks() cleared it
    spotifyFindUniqueMock.mockResolvedValue({
      ...enc,
      spotifyUserId: "u1",
      scope: "playlist-modify-public",
    });
  }

  it("accepts a rock track", async () => {
    genreFindManyMock.mockResolvedValue([{ keyword: "pagode", active: true }]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "t1", name: "Bohemian Rhapsody", uri: "spotify:track:t1", artists: [{ id: "queen" }] },
      { queen: { name: "Queen", genres: ["rock", "classic rock"] } }
    );

    const result = await evaluateTrack("t1");
    expect(result.outcome).toBe("accept");
    if (result.outcome === "accept") {
      expect(result.trackName).toBe("Bohemian Rhapsody");
      expect(result.artistName).toBe("Queen");
    }
  });

  it("rejects on genre substring match (case-insensitive)", async () => {
    genreFindManyMock.mockResolvedValue([{ keyword: "funk carioca", active: true }]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "t2", name: "Foo", uri: "spotify:track:t2", artists: [{ id: "mckev" }] },
      { mckev: { name: "MC Kevinho", genres: ["Funk Carioca", "Funk Ostentação"] } }
    );

    const result = await evaluateTrack("t2");
    expect(result.outcome).toBe("reject_genre");
    if (result.outcome === "reject_genre") {
      expect(result.matchedKeyword.toLowerCase()).toBe("funk carioca");
    }
  });

  it("rejects on artist blocklist match", async () => {
    genreFindManyMock.mockResolvedValue([]);
    artistFindManyMock.mockResolvedValue([
      { spotifyArtistId: "badArt", artistName: "Bad Artist" },
    ]);

    mockSpotify(
      { id: "t3", name: "Foo", uri: "spotify:track:t3", artists: [{ id: "badArt" }] },
      { badArt: { name: "Bad Artist", genres: ["jazz"] } }
    );

    const result = await evaluateTrack("t3");
    expect(result.outcome).toBe("reject_artist");
  });

  it("rejects when ANY artist on a multi-artist track is blocked", async () => {
    genreFindManyMock.mockResolvedValue([{ keyword: "pagode", active: true }]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "t4", name: "Collab", uri: "spotify:track:t4", artists: [{ id: "a1" }, { id: "a2" }] },
      {
        a1: { name: "Clean Artist", genres: ["pop", "rock"] },
        a2: { name: "Pagode Feature", genres: ["samba pagode"] },
      }
    );

    const result = await evaluateTrack("t4");
    expect(result.outcome).toBe("reject_genre");
  });

  it("accepts when artist has no genre tags at all", async () => {
    genreFindManyMock.mockResolvedValue([{ keyword: "pagode", active: true }]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "t5", name: "Unknown Indie", uri: "spotify:track:t5", artists: [{ id: "indie" }] },
      { indie: { name: "Indie", genres: [] } }
    );

    const result = await evaluateTrack("t5");
    expect(result.outcome).toBe("accept");
  });

  it("ignores inactive blocklist entries", async () => {
    // findMany with active:true filter returns empty (inactive entry not returned)
    genreFindManyMock.mockResolvedValue([]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "t6", name: "Foo", uri: "spotify:track:t6", artists: [{ id: "a" }] },
      { a: { name: "A", genres: ["rock"] } }
    );

    const result = await evaluateTrack("t6");
    expect(result.outcome).toBe("accept");
  });

  it("accepts explicit content (no longer blocked at the gym)", async () => {
    genreFindManyMock.mockResolvedValue([]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "t7", name: "Foo", uri: "spotify:track:t7", explicit: true, artists: [{ id: "a" }] },
      { a: { name: "Eminem", genres: ["detroit hip hop", "hip hop", "rap"] } }
    );

    const result = await evaluateTrack("t7");
    expect(result.outcome).toBe("accept");
  });

  it("rejects when ARTIST keyword matches the artist name", async () => {
    genreFindManyMock.mockResolvedValue([{ keyword: "anitta", field: "artist", active: true }]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "t8", name: "Some Track", uri: "spotify:track:t8", artists: [{ id: "anitta-id" }] },
      { "anitta-id": { name: "Anitta", genres: ["pop"] } }
    );

    const result = await evaluateTrack("t8");
    expect(result.outcome).toBe("reject_genre");
    if (result.outcome === "reject_genre") {
      expect(result.matchedKeyword).toBe("anitta");
      expect(result.matchedAgainst).toBe("artist_name");
    }
  });

  it("rejects when TRACK keyword matches the track name", async () => {
    genreFindManyMock.mockResolvedValue([{ keyword: "putaria", field: "track", active: true }]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "t9", name: "Festa de Putaria", uri: "spotify:track:t9", artists: [{ id: "x" }] },
      { x: { name: "Unknown Artist", genres: ["pop"] } }
    );

    const result = await evaluateTrack("t9");
    expect(result.outcome).toBe("reject_genre");
    if (result.outcome === "reject_genre") {
      expect(result.matchedAgainst).toBe("track_name");
    }
  });

  it("does NOT let a GENRE keyword leak into the track name (field-scoped)", async () => {
    // "sleep" is a genre keyword; a track titled "Sleepless" must NOT be blocked.
    genreFindManyMock.mockResolvedValue([{ keyword: "sleep", field: "genre", active: true }]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "tF", name: "Sleepless", uri: "spotify:track:tF", artists: [{ id: "a" }] },
      { a: { name: "Some Artist", genres: ["rock"] } }
    );

    const result = await evaluateTrack("tF");
    expect(result.outcome).toBe("accept");
  });

  it("does NOT let an ARTIST keyword leak into the track name (field-scoped)", async () => {
    // "adele" is an artist keyword; the title "Madeleine" contains it as a substring
    // but must NOT be blocked because the keyword is scoped to the artist field.
    genreFindManyMock.mockResolvedValue([{ keyword: "adele", field: "artist", active: true }]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "tG", name: "Madeleine", uri: "spotify:track:tG", artists: [{ id: "a" }] },
      { a: { name: "Some Artist", genres: ["rock"] } }
    );

    const result = await evaluateTrack("tG");
    expect(result.outcome).toBe("accept");
  });

  it("matches keyword across diacritic variants (axé ↔ axe)", async () => {
    // Keyword stored without accent, artist genre has accent — should still match
    genreFindManyMock.mockResolvedValue([{ keyword: "axe", field: "genre", active: true }]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "tA", name: "Foo", uri: "spotify:track:tA", artists: [{ id: "a" }] },
      { a: { name: "Some Artist", genres: ["Axé Bahia"] } }
    );

    const result = await evaluateTrack("tA");
    expect(result.outcome).toBe("reject_genre");
  });

  it("matches keyword with accent against text without accent", async () => {
    // Keyword has accent, track name doesn't — normalization on both sides
    genreFindManyMock.mockResolvedValue([{ keyword: "modão", field: "track", active: true }]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "tB", name: "Modao Sertanejo", uri: "spotify:track:tB", artists: [{ id: "a" }] },
      { a: { name: "Some Artist", genres: ["country"] } }
    );

    const result = await evaluateTrack("tB");
    expect(result.outcome).toBe("reject_genre");
    if (result.outcome === "reject_genre") {
      expect(result.matchedAgainst).toBe("track_name");
    }
  });

  it("allowlist overrides keyword filter", async () => {
    // "acoustic" keyword would normally catch "Poesia Acústica" via artist name,
    // but allowlist short-circuits and accepts
    genreFindManyMock.mockResolvedValue([{ keyword: "acoustic", active: true }]);
    artistFindManyMock.mockResolvedValue([]);
    allowedArtistFindManyMock.mockResolvedValue([
      { spotifyArtistId: "poesia-id", artistName: "Poesia Acústica" },
    ]);

    mockSpotify(
      { id: "tC", name: "Cypher 14", uri: "spotify:track:tC", artists: [{ id: "poesia-id" }] },
      { "poesia-id": { name: "Poesia Acústica", genres: ["brazilian trap"] } }
    );

    const result = await evaluateTrack("tC");
    expect(result.outcome).toBe("accept");
    if (result.outcome === "accept") {
      expect(result.allowlistedArtistId).toBe("poesia-id");
    }
  });

  it("accepts an explicit track from an allowlisted artist", async () => {
    // Explicit is no longer blocked; allowlist still short-circuits the keyword filter
    genreFindManyMock.mockResolvedValue([]);
    artistFindManyMock.mockResolvedValue([]);
    allowedArtistFindManyMock.mockResolvedValue([
      { spotifyArtistId: "poesia-id", artistName: "Poesia Acústica" },
    ]);

    mockSpotify(
      { id: "tD", name: "Explicit Cypher", uri: "spotify:track:tD", explicit: true, artists: [{ id: "poesia-id" }] },
      { "poesia-id": { name: "Poesia Acústica", genres: ["brazilian trap"] } }
    );

    const result = await evaluateTrack("tD");
    expect(result.outcome).toBe("accept");
    if (result.outcome === "accept") {
      expect(result.allowlistedArtistId).toBe("poesia-id");
    }
  });

  it("allowlist does NOT override artist blocklist", async () => {
    // Defensive: if an artist is both blocked and allowed, blocklist wins
    genreFindManyMock.mockResolvedValue([]);
    artistFindManyMock.mockResolvedValue([
      { spotifyArtistId: "x", artistName: "Banned" },
    ]);
    allowedArtistFindManyMock.mockResolvedValue([
      { spotifyArtistId: "x", artistName: "Banned" },
    ]);

    mockSpotify(
      { id: "tE", name: "Foo", uri: "spotify:track:tE", artists: [{ id: "x" }] },
      { x: { name: "Banned", genres: ["rock"] } }
    );

    const result = await evaluateTrack("tE");
    expect(result.outcome).toBe("reject_artist");
  });

  it("still applies the genre filter to explicit tracks", async () => {
    // Explicit no longer short-circuits — a blocked genre is still rejected
    genreFindManyMock.mockResolvedValue([{ keyword: "pagode", field: "genre", active: true }]);
    artistFindManyMock.mockResolvedValue([]);

    mockSpotify(
      { id: "t10", name: "Foo", uri: "spotify:track:t10", explicit: true, artists: [{ id: "x" }] },
      { x: { name: "X", genres: ["samba pagode"] } }
    );

    const result = await evaluateTrack("t10");
    expect(result.outcome).toBe("reject_genre");
  });
});
