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
  spotifyFindUniqueMock,
  spotifyUpsertMock,
} = vi.hoisted(() => ({
  genreDeleteManyMock: vi.fn(),
  genreCreateMock: vi.fn(),
  genreFindManyMock: vi.fn(),
  artistDeleteManyMock: vi.fn(),
  artistCreateMock: vi.fn(),
  artistFindManyMock: vi.fn(),
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
    spotifyFindUniqueMock.mockReset();
    spotifyUpsertMock.mockReset();
    __resetTokenCacheForTests();

    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.SPOTIFY_CLIENT_ID = "cid";
    process.env.SPOTIFY_CLIENT_SECRET = "csec";

    // Default: no blocked artists
    artistFindManyMock.mockResolvedValue([]);

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
    track: { id: string; name: string; uri: string; artists: Array<{ id: string; name?: string }> },
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
});
