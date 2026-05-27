import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock variables are available when vi.mock factory runs (hoisted to top)
const {
  deleteManyMock,
  createMock,
  findUniqueMock,
  playlistUpdateMock,
  spotifyUpsertMock,
  spotifyFindUniqueMock,
  songFindUniqueMock,
  songUpdateMock,
  songUpdateManyMock,
  songCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  deleteManyMock: vi.fn(),
  createMock: vi.fn(),
  findUniqueMock: vi.fn(),
  playlistUpdateMock: vi.fn(),
  spotifyUpsertMock: vi.fn(),
  spotifyFindUniqueMock: vi.fn(),
  songFindUniqueMock: vi.fn(),
  songUpdateMock: vi.fn(),
  songUpdateManyMock: vi.fn(),
  songCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

// Mock the DB so importing playlist-manager doesn't require DATABASE_URL
vi.mock("@/lib/db", () => {
  const dbMock = {
    waClassPlaylist: {
      deleteMany: deleteManyMock,
      create: createMock,
      findUnique: findUniqueMock,
      update: playlistUpdateMock,
    },
    waSongRequest: {
      findUnique: songFindUniqueMock,
      update: songUpdateMock,
      updateMany: songUpdateManyMock,
      create: songCreateMock,
    },
    spotifyToken: {
      upsert: spotifyUpsertMock,
      findUnique: spotifyFindUniqueMock,
    },
    $transaction: transactionMock,
  };
  return { db: dbMock };
});

import { encryptToken } from "@/lib/spotify/token-store";
import { __resetTokenCacheForTests } from "@/lib/spotify/client";
import {
  createClassPlaylist,
  insertSongAtNextPosition,
  removeSongAndRecompress,
  swapSong,
} from "@/lib/spotify/playlist-manager";

// $transaction supports both callback form (insertSong) and array form (remove, swap).
// Default impl: if arg is a function, invoke it with a tx whose methods match the
// flat db mock; if arg is an array, return Promise.all of the array (the mocks
// already return promises). Tests can override per-case as needed.
type TxShape = {
  waClassPlaylist: {
    update: typeof playlistUpdateMock;
    findUnique: typeof findUniqueMock;
    create: typeof createMock;
  };
  waSongRequest: {
    findUnique: typeof songFindUniqueMock;
    update: typeof songUpdateMock;
    updateMany: typeof songUpdateManyMock;
    create: typeof songCreateMock;
  };
};

function installDefaultTransactionMock() {
  transactionMock.mockImplementation(async (input: unknown) => {
    if (typeof input === "function") {
      const tx: TxShape = {
        waClassPlaylist: {
          update: playlistUpdateMock,
          findUnique: findUniqueMock,
          create: createMock,
        },
        waSongRequest: {
          findUnique: songFindUniqueMock,
          update: songUpdateMock,
          updateMany: songUpdateManyMock,
          create: songCreateMock,
        },
      };
      return await (input as (tx: TxShape) => Promise<unknown>)(tx);
    }
    if (Array.isArray(input)) {
      return await Promise.all(input);
    }
    return undefined;
  });
}

describe("createClassPlaylist", () => {
  beforeEach(async () => {
    deleteManyMock.mockReset();
    createMock.mockReset();
    findUniqueMock.mockReset();
    playlistUpdateMock.mockReset();
    spotifyUpsertMock.mockReset();
    spotifyFindUniqueMock.mockReset();
    songFindUniqueMock.mockReset();
    songUpdateMock.mockReset();
    songUpdateManyMock.mockReset();
    songCreateMock.mockReset();
    transactionMock.mockReset();
    installDefaultTransactionMock();
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

describe("insertSongAtNextPosition", () => {
  beforeEach(() => {
    deleteManyMock.mockReset();
    createMock.mockReset();
    findUniqueMock.mockReset();
    playlistUpdateMock.mockReset();
    spotifyUpsertMock.mockReset();
    spotifyFindUniqueMock.mockReset();
    songFindUniqueMock.mockReset();
    songUpdateMock.mockReset();
    songUpdateManyMock.mockReset();
    songCreateMock.mockReset();
    transactionMock.mockReset();
    installDefaultTransactionMock();
    __resetTokenCacheForTests();

    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.SPOTIFY_CLIENT_ID = "cid";
    process.env.SPOTIFY_CLIENT_SECRET = "csec";

    const enc = encryptToken("rt");
    spotifyFindUniqueMock.mockResolvedValue({
      ...enc,
      spotifyUserId: "user1",
      scope: "playlist-modify-public",
    });
  });

  it("inserts at position = requestCount and increments counter atomically", async () => {
    // Tx update returns playlist with new requestCount (3 = 2 + increment)
    playlistUpdateMock.mockResolvedValueOnce({
      id: "cuid",
      yogoClassId: 100,
      spotifyPlaylistId: "pl100",
      requestCount: 3,
      locked: false,
      createdAt: new Date(),
    });

    let receivedBody: { uris: string[]; position: number } | null = null;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("accounts.spotify.com")) {
        return new Response(
          JSON.stringify({ access_token: "t", expires_in: 3600 }),
          { status: 200 }
        );
      }
      if (url.endsWith("/playlists/pl100/tracks") && init?.method === "POST") {
        receivedBody = JSON.parse(init.body as string);
        return new Response(JSON.stringify({ snapshot_id: "s" }), { status: 201 });
      }
      return new Response("nope", { status: 500 });
    }) as typeof fetch;

    const result = await insertSongAtNextPosition({
      yogoClassId: 100,
      trackUri: "spotify:track:xyz",
    });

    expect(result.position).toBe(2);
    expect(receivedBody).not.toBeNull();
    expect(receivedBody!.position).toBe(2);
    expect(receivedBody!.uris).toEqual(["spotify:track:xyz"]);
    expect(playlistUpdateMock).toHaveBeenCalledWith({
      where: { yogoClassId: 100 },
      data: { requestCount: { increment: 1 } },
    });
  });

  it("rolls back requestCount when Spotify add fails", async () => {
    playlistUpdateMock.mockResolvedValueOnce({
      id: "cuid",
      yogoClassId: 101,
      spotifyPlaylistId: "pl101",
      requestCount: 1,
      locked: false,
      createdAt: new Date(),
    });
    // second update (rollback) just resolves
    playlistUpdateMock.mockResolvedValueOnce({
      id: "cuid",
      yogoClassId: 101,
      spotifyPlaylistId: "pl101",
      requestCount: 0,
      locked: false,
      createdAt: new Date(),
    });

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("accounts.spotify.com")) {
        return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      }
      return new Response("forbidden", { status: 403 });
    }) as typeof fetch;

    await expect(
      insertSongAtNextPosition({ yogoClassId: 101, trackUri: "spotify:track:zzz" })
    ).rejects.toThrow(/Spotify add track failed/);

    // Decrement called for rollback
    expect(playlistUpdateMock).toHaveBeenCalledTimes(2);
    expect(playlistUpdateMock.mock.calls[1][0]).toEqual({
      where: { yogoClassId: 101 },
      data: { requestCount: { decrement: 1 } },
    });
  });
});

describe("removeSongAndRecompress", () => {
  beforeEach(() => {
    deleteManyMock.mockReset();
    createMock.mockReset();
    findUniqueMock.mockReset();
    playlistUpdateMock.mockReset();
    spotifyUpsertMock.mockReset();
    spotifyFindUniqueMock.mockReset();
    songFindUniqueMock.mockReset();
    songUpdateMock.mockReset();
    songUpdateManyMock.mockReset();
    songCreateMock.mockReset();
    transactionMock.mockReset();
    installDefaultTransactionMock();
    __resetTokenCacheForTests();

    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.SPOTIFY_CLIENT_ID = "cid";
    process.env.SPOTIFY_CLIENT_SECRET = "csec";

    const enc = encryptToken("rt");
    spotifyFindUniqueMock.mockResolvedValue({
      ...enc,
      spotifyUserId: "user1",
      scope: "playlist-modify-public",
    });
  });

  it("deletes from Spotify, marks request cancelled, shifts higher positions down, decrements counter", async () => {
    songFindUniqueMock.mockResolvedValueOnce({
      id: "r1",
      contactId: "+351900000001",
      yogoClassId: 200,
      spotifyTrackId: "t1",
      spotifyTrackName: "n1",
      spotifyArtistName: "a1",
      spotifyTrackUri: "spotify:track:t1",
      position: 0,
      status: "active",
      rejectedReason: null,
      createdAt: new Date(),
    });
    findUniqueMock.mockResolvedValueOnce({
      id: "cuid",
      yogoClassId: 200,
      spotifyPlaylistId: "pl200",
      requestCount: 3,
      locked: false,
      createdAt: new Date(),
    });

    let deleteBody: { tracks: { uri: string }[] } | null = null;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("accounts.spotify.com")) {
        return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      }
      if (url.endsWith("/playlists/pl200/tracks") && init?.method === "DELETE") {
        deleteBody = JSON.parse(init.body as string);
        return new Response(JSON.stringify({ snapshot_id: "s" }), { status: 200 });
      }
      return new Response("nope", { status: 500 });
    }) as typeof fetch;

    await removeSongAndRecompress("r1");

    expect(deleteBody).not.toBeNull();
    expect(deleteBody!.tracks).toEqual([{ uri: "spotify:track:t1" }]);

    // Verify the transaction operations were invoked
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(songUpdateMock).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "cancelled_by_unbook" },
    });
    expect(songUpdateManyMock).toHaveBeenCalledWith({
      where: {
        yogoClassId: 200,
        status: "active",
        position: { gt: 0 },
      },
      data: { position: { decrement: 1 } },
    });
    expect(playlistUpdateMock).toHaveBeenCalledWith({
      where: { yogoClassId: 200 },
      data: { requestCount: { decrement: 1 } },
    });
  });

  it("is a no-op when the request is not active", async () => {
    songFindUniqueMock.mockResolvedValueOnce({
      id: "rX",
      contactId: "+351900000001",
      yogoClassId: 200,
      spotifyTrackId: "t1",
      spotifyTrackName: "n1",
      spotifyArtistName: "a1",
      spotifyTrackUri: "spotify:track:t1",
      position: 0,
      status: "swapped",
      rejectedReason: null,
      createdAt: new Date(),
    });

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await removeSongAndRecompress("rX");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

describe("swapSong", () => {
  beforeEach(() => {
    deleteManyMock.mockReset();
    createMock.mockReset();
    findUniqueMock.mockReset();
    playlistUpdateMock.mockReset();
    spotifyUpsertMock.mockReset();
    spotifyFindUniqueMock.mockReset();
    songFindUniqueMock.mockReset();
    songUpdateMock.mockReset();
    songUpdateManyMock.mockReset();
    songCreateMock.mockReset();
    transactionMock.mockReset();
    installDefaultTransactionMock();
    __resetTokenCacheForTests();

    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.SPOTIFY_CLIENT_ID = "cid";
    process.env.SPOTIFY_CLIENT_SECRET = "csec";

    const enc = encryptToken("rt");
    spotifyFindUniqueMock.mockResolvedValue({
      ...enc,
      spotifyUserId: "user1",
      scope: "playlist-modify-public",
    });
  });

  it("removes old uri, inserts new at SAME position, marks old swapped, keeps requestCount stable", async () => {
    songFindUniqueMock.mockResolvedValueOnce({
      id: "old1",
      contactId: "+351900000010",
      yogoClassId: 300,
      spotifyTrackId: "old",
      spotifyTrackName: "n",
      spotifyArtistName: "a",
      spotifyTrackUri: "spotify:track:old",
      position: 0,
      status: "active",
      rejectedReason: null,
      createdAt: new Date(),
    });
    findUniqueMock.mockResolvedValueOnce({
      id: "cuid",
      yogoClassId: 300,
      spotifyPlaylistId: "pl300",
      requestCount: 1,
      locked: false,
      createdAt: new Date(),
    });
    songCreateMock.mockResolvedValueOnce({
      id: "new1",
      contactId: "+351900000010",
      yogoClassId: 300,
      spotifyTrackId: "new",
      spotifyTrackName: "newName",
      spotifyArtistName: "newArtist",
      spotifyTrackUri: "spotify:track:new",
      position: 0,
      status: "active",
      rejectedReason: null,
      createdAt: new Date(),
    });

    const ops: { method: string | undefined; body: unknown }[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("accounts.spotify.com")) {
        return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      }
      if (url.endsWith("/playlists/pl300/tracks")) {
        ops.push({
          method: init?.method,
          body: init?.body ? JSON.parse(init.body as string) : undefined,
        });
        return new Response(JSON.stringify({ snapshot_id: "s" }), { status: 200 });
      }
      return new Response("nope", { status: 500 });
    }) as typeof fetch;

    const result = await swapSong({
      oldRequestId: "old1",
      newTrackUri: "spotify:track:new",
      newTrackId: "new",
      newTrackName: "newName",
      newArtistName: "newArtist",
      contactId: "+351900000010",
    });

    expect(result.position).toBe(0);
    expect(result.newRequestId).toBe("new1");

    const delOp = ops.find((o) => o.method === "DELETE");
    const addOp = ops.find((o) => o.method === "POST");
    expect(delOp).toBeDefined();
    expect(addOp).toBeDefined();
    expect((delOp!.body as { tracks: { uri: string }[] }).tracks[0].uri).toBe(
      "spotify:track:old"
    );
    expect((addOp!.body as { position: number; uris: string[] }).position).toBe(0);
    expect((addOp!.body as { position: number; uris: string[] }).uris[0]).toBe(
      "spotify:track:new"
    );

    expect(songUpdateMock).toHaveBeenCalledWith({
      where: { id: "old1" },
      data: { status: "swapped" },
    });
    expect(songCreateMock).toHaveBeenCalled();
    // Counter unchanged: swap doesn't touch waClassPlaylist.update directly
    expect(playlistUpdateMock).not.toHaveBeenCalled();
  });

  it("throws when oldRequestId is not active", async () => {
    songFindUniqueMock.mockResolvedValueOnce(null);
    await expect(
      swapSong({
        oldRequestId: "missing",
        newTrackUri: "spotify:track:n",
        newTrackId: "n",
        newTrackName: "n",
        newArtistName: "a",
        contactId: "+351900000010",
      })
    ).rejects.toThrow(/old request not active/);
  });
});
