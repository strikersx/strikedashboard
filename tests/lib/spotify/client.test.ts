import { describe, it, expect, beforeEach, vi } from "vitest";

// Use vi.hoisted so mock variables are available when vi.mock factory runs (hoisted to top)
const { upsertMock, findUniqueMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

// Mock the DB so importing token-store doesn't require DATABASE_URL
vi.mock("@/lib/db", () => ({
  db: {
    spotifyToken: {
      upsert: upsertMock,
      findUnique: findUniqueMock,
    },
  },
}));

import { encryptToken, decryptToken, saveRefreshToken } from "@/lib/spotify/token-store";

beforeEach(() => {
  process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  upsertMock.mockReset();
  findUniqueMock.mockReset();
});

describe("token-store crypto", () => {
  it("round-trips a refresh token via AES-256-GCM", () => {
    const plaintext = "AQB-mock-refresh-token-1234567890";
    const encrypted = encryptToken(plaintext);
    expect(encrypted.ciphertext).not.toContain(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it("fails to decrypt if authTag is tampered", () => {
    const encrypted = encryptToken("secret");
    expect(() =>
      decryptToken({ ...encrypted, authTag: Buffer.alloc(16, 0).toString("base64") })
    ).toThrow();
  });
});

import { spotifyFetch, __resetTokenCacheForTests } from "@/lib/spotify/client";

describe("spotifyFetch", () => {
  beforeEach(() => {
    __resetTokenCacheForTests();
  });

  it("refreshes access token then makes the API call", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn().mockImplementation(async (url: string, _init?: RequestInit) => {
      calls.push(url as string);
      if ((url as string).includes("accounts.spotify.com/api/token")) {
        return new Response(JSON.stringify({ access_token: "tok123", expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // arrange: pre-seed DB with a refresh token
    process.env.SPOTIFY_CLIENT_ID = "cid";
    process.env.SPOTIFY_CLIENT_SECRET = "csec";
    await saveRefreshToken("refresh-xyz", "user-1", "playlist-modify-public");

    // loadRefreshToken will be called by spotifyFetch; mock the DB read
    const enc = encryptToken("refresh-xyz");
    findUniqueMock.mockResolvedValueOnce({
      ...enc,
      spotifyUserId: "user-1",
      scope: "playlist-modify-public",
    });

    const res = await spotifyFetch("/v1/me");
    expect(res.status).toBe(200);
    expect(calls[0]).toContain("accounts.spotify.com/api/token");
    expect(calls[1]).toContain("api.spotify.com/v1/me");
  });
});
