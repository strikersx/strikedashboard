import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock variables are available when vi.mock factory runs (hoisted to top)
const { deleteManyMock, createMock, findUniqueMock, spotifyUpsertMock, spotifyFindUniqueMock } =
  vi.hoisted(() => ({
    deleteManyMock: vi.fn(),
    createMock: vi.fn(),
    findUniqueMock: vi.fn(),
    spotifyUpsertMock: vi.fn(),
    spotifyFindUniqueMock: vi.fn(),
  }));

// Mock the DB so importing playlist-manager doesn't require DATABASE_URL
vi.mock("@/lib/db", () => ({
  db: {
    waClassPlaylist: {
      deleteMany: deleteManyMock,
      create: createMock,
      findUnique: findUniqueMock,
    },
    spotifyToken: {
      upsert: spotifyUpsertMock,
      findUnique: spotifyFindUniqueMock,
    },
  },
}));

import { encryptToken } from "@/lib/spotify/token-store";
import { __resetTokenCacheForTests } from "@/lib/spotify/client";
import { createClassPlaylist } from "@/lib/spotify/playlist-manager";

describe("createClassPlaylist", () => {
  beforeEach(async () => {
    deleteManyMock.mockReset();
    createMock.mockReset();
    findUniqueMock.mockReset();
    spotifyUpsertMock.mockReset();
    spotifyFindUniqueMock.mockReset();
    __resetTokenCacheForTests();

    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.SPOTIFY_BASE_PLAYLIST_ID = "basepl";
    process.env.SPOTIFY_CLIENT_ID = "cid";
    process.env.SPOTIFY_CLIENT_SECRET = "csec";
  });

  it("creates a Spotify playlist, seeds 20 shuffled tracks, persists row", async () => {
    const apiCalls: { url: string; method: string; body?: unknown }[] = [];
    const mockTracks = Array.from({ length: 50 }, (_, i) => ({
      track: { uri: `spotify:track:base${i}` },
    }));

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      apiCalls.push({ url, method: init?.method ?? "GET", body: init?.body });
      if (url.includes("accounts.spotify.com")) {
        return new Response(
          JSON.stringify({ access_token: "tok", expires_in: 3600 }),
          { status: 200 }
        );
      }
      if (
        url.includes("/playlists/basepl/tracks") &&
        (!init?.method || init.method === "GET")
      ) {
        return new Response(
          JSON.stringify({ items: mockTracks, next: null }),
          { status: 200 }
        );
      }
      if (url.includes("/users/user1/playlists") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "newpl123" }), { status: 201 });
      }
      if (url.includes("/playlists/newpl123/tracks") && init?.method === "POST") {
        return new Response(JSON.stringify({ snapshot_id: "abc" }), { status: 201 });
      }
      return new Response("not mocked", { status: 500 });
    }) as typeof fetch;

    // pre-seed: loadRefreshToken will use spotifyFindUniqueMock
    // Use mockResolvedValue (not Once) because loadRefreshToken is called twice:
    // once directly by createClassPlaylist (for spotifyUserId) and once by
    // spotifyFetch's getAccessToken (to exchange refresh token for access token).
    const enc = encryptToken("rt");
    spotifyFindUniqueMock.mockResolvedValue({
      ...enc,
      spotifyUserId: "user1",
      scope: "playlist-modify-public",
    });

    // no existing playlist
    findUniqueMock.mockResolvedValueOnce(null);
    // db.create returns the persisted row
    createMock.mockResolvedValueOnce({
      id: "cuid1",
      yogoClassId: 999,
      spotifyPlaylistId: "newpl123",
      createdAt: new Date(),
      requestCount: 0,
      locked: false,
    });

    const result = await createClassPlaylist({
      yogoClassId: 999,
      className: "Muay Thai",
      startsAtIso: "2026-05-27T19:00:00Z",
    });

    expect(result.spotifyPlaylistId).toBe("newpl123");
    expect(result.created).toBe(true);

    // Verify db.create was called with correct data
    expect(createMock).toHaveBeenCalledWith({
      data: { yogoClassId: 999, spotifyPlaylistId: "newpl123" },
    });

    // The returned mock row says requestCount=0 and locked=false
    const createCall = createMock.mock.calls[0][0];
    // (spot-check the data shape; requestCount/locked are DB defaults)
    expect(createCall.data.yogoClassId).toBe(999);

    const addCall = apiCalls.find(
      (c) => c.url.endsWith("/playlists/newpl123/tracks") && c.method === "POST"
    );
    expect(addCall).toBeDefined();
    const body = JSON.parse(addCall!.body as string);
    expect(body.uris).toHaveLength(20);
    expect(body.position).toBe(0);
  });

  it("is idempotent — second call for same yogoClassId is a no-op", async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: "cuid2",
      yogoClassId: 555,
      spotifyPlaylistId: "existing",
      createdAt: new Date(),
      requestCount: 0,
      locked: false,
    });

    const result = await createClassPlaylist({
      yogoClassId: 555,
      className: "BJJ",
      startsAtIso: "2026-05-27T20:00:00Z",
    });

    expect(result.spotifyPlaylistId).toBe("existing");
    expect(result.created).toBe(false);
    // Should not have called Spotify API at all
    expect(createMock).not.toHaveBeenCalled();
  });
});
