# Spotify Playlist Per Class Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each group class at Strike's House gets an auto-generated Spotify playlist daily; enrolled students request one song via WhatsApp that plays at the top (FIFO); blocked genres rejected synchronously; cancelling a booking removes the song.

**Architecture:** A Vercel cron creates one Spotify playlist per Yogo group class daily, seeded with 20 shuffled tracks from a master playlist. A new WhatsApp handler (`song-request`) hooks the existing reservar/cancelar flows — after a booking is confirmed, the bot offers to add a song; the student replies with a Spotify link or text; the bot resolves the track, fetches artist genres, validates against a blocklist, and inserts at the next FIFO position. Cancelling a booking deletes the song and recompresses positions. Admin UI manages the blocklist of genre keywords and artist IDs.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Prisma + SQLite (Turso prod) · Tailwind v4 · vitest · Vercel cron · Spotify Web API · WhatsApp Cloud API (existing bot v1).

**Spec:** `docs/superpowers/specs/2026-05-27-spotify-playlist-per-class-design.md`

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   └── spotify-playlists/route.ts        # Task 4 — daily cron
│   │   ├── spotify/
│   │   │   └── auth/
│   │   │       ├── start/route.ts                # Task 3 — OAuth begin
│   │   │       └── callback/route.ts             # Task 3 — OAuth callback
│   │   ├── whatsapp/
│   │   │   ├── webhook/route.ts                  # Task 10, 12 — modified dispatch
│   │   │   └── admin/
│   │   │       └── spotify-blocklist/route.ts    # Task 14 — admin CRUD
│   │   └── ...
│   └── dashboard/
│       └── wa/
│           ├── spotify-auth/page.tsx             # Task 3 — one-time admin auth UI
│           └── blocklist/page.tsx                # Task 14 — admin UI
├── lib/
│   ├── spotify/
│   │   ├── client.ts                             # Task 2 — HTTP + token refresh
│   │   ├── token-store.ts                        # Task 2 — encrypted persistence
│   │   ├── playlist-manager.ts                   # Task 5 — create/insert/remove
│   │   └── genre-filter.ts                       # Task 7 — blocklist matching
│   └── wa/
│       ├── handlers/
│       │   ├── reservar.ts                       # Task 9 — hook post-confirm
│       │   ├── cancelar.ts                       # Task 11 — hook post-cancel
│       │   ├── menu.ts                           # Task 13 — new Playlist entry
│       │   ├── song-request.ts                   # Task 8, 10, 11, 12 — new handler
│       │   └── playlist-list.ts                  # Task 13 — new handler
│       ├── session.ts                            # Task 8 — new states
│       └── parser.ts                             # Task 10 — Spotify URL parser
└── prisma/
    ├── schema.prisma                             # Tasks 1, 6, 7, 8
    └── seed/seed-blocked-genres.ts               # Task 7 — initial blocklist
tests/
└── lib/
    ├── spotify/
    │   ├── client.test.ts                        # Task 2
    │   ├── playlist-manager.test.ts              # Task 5
    │   └── genre-filter.test.ts                  # Task 7
    └── wa/
        ├── parser-spotify.test.ts                # Task 10
        └── song-request.test.ts                  # Task 10, 11, 12
```

---

## Task 1: Prisma schema — Spotify token storage

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_spotify_token/migration.sql` (auto-generated)

- [ ] **Step 1: Add model to `prisma/schema.prisma`**

Append after the existing `WaGroupMember` model:

```prisma
model SpotifyToken {
  id              String   @id @default("singleton")
  ciphertext      String   // AES-256-GCM encrypted refresh token
  iv              String   // base64 nonce
  authTag         String   // base64 GCM tag
  spotifyUserId   String   // Spotify user that owns the playlists
  scope           String   // granted scopes (space-separated)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

- [ ] **Step 2: Generate migration**

Run: `npx prisma migrate dev --name spotify_token`
Expected: migration applied, `SpotifyToken` table exists in `dev.db`.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(spotify): add SpotifyToken model for encrypted refresh token storage"
```

---

## Task 2: Encrypted token store + Spotify HTTP client

**Files:**
- Create: `src/lib/spotify/token-store.ts`
- Create: `src/lib/spotify/client.ts`
- Create: `tests/lib/spotify/client.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add env vars to `.env.example`**

Append:

```
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/auth/callback
SPOTIFY_TOKEN_ENCRYPTION_KEY=        # 32 bytes base64 (openssl rand -base64 32)
SPOTIFY_BASE_PLAYLIST_ID=
```

- [ ] **Step 2: Write failing test for token store**

Create `tests/lib/spotify/client.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { encryptToken, decryptToken } from "@/lib/spotify/token-store";

beforeEach(() => {
  process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
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
```

- [ ] **Step 3: Run test, verify fail**

Run: `npm test -- tests/lib/spotify/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement token store**

Create `src/lib/spotify/token-store.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("SPOTIFY_TOKEN_ENCRYPTION_KEY not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("SPOTIFY_TOKEN_ENCRYPTION_KEY must be 32 bytes base64");
  return key;
}

export interface EncryptedToken {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptToken(plaintext: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ct.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptToken(e: EncryptedToken): string {
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(e.iv, "base64"));
  decipher.setAuthTag(Buffer.from(e.authTag, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(e.ciphertext, "base64")), decipher.final()]);
  return pt.toString("utf8");
}

export async function saveRefreshToken(
  refreshToken: string,
  spotifyUserId: string,
  scope: string
): Promise<void> {
  const enc = encryptToken(refreshToken);
  await db.spotifyToken.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...enc, spotifyUserId, scope },
    update: { ...enc, spotifyUserId, scope },
  });
}

export async function loadRefreshToken(): Promise<{ refreshToken: string; spotifyUserId: string } | null> {
  const row = await db.spotifyToken.findUnique({ where: { id: "singleton" } });
  if (!row) return null;
  return {
    refreshToken: decryptToken({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag }),
    spotifyUserId: row.spotifyUserId,
  };
}
```

- [ ] **Step 5: Run test, verify pass**

Run: `npm test -- tests/lib/spotify/client.test.ts`
Expected: PASS (both crypto round-trip tests).

- [ ] **Step 6: Add client test**

Append to `tests/lib/spotify/client.test.ts`:

```typescript
import { spotifyFetch, __resetTokenCacheForTests } from "@/lib/spotify/client";

describe("spotifyFetch", () => {
  beforeEach(() => {
    __resetTokenCacheForTests();
  });

  it("refreshes access token then makes the API call", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (url.includes("accounts.spotify.com/api/token")) {
        return new Response(JSON.stringify({ access_token: "tok123", expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    globalThis.fetch = fetchMock as any;

    // arrange: pre-seed DB with a refresh token
    process.env.SPOTIFY_CLIENT_ID = "cid";
    process.env.SPOTIFY_CLIENT_SECRET = "csec";
    await saveRefreshToken("refresh-xyz", "user-1", "playlist-modify-public");

    const res = await spotifyFetch("/v1/me");
    expect(res.status).toBe(200);
    expect(calls[0]).toContain("accounts.spotify.com/api/token");
    expect(calls[1]).toContain("api.spotify.com/v1/me");
  });
});
```

Add imports at top of the file:

```typescript
import { vi } from "vitest";
import { saveRefreshToken } from "@/lib/spotify/token-store";
```

- [ ] **Step 7: Run test, verify fail**

Run: `npm test -- tests/lib/spotify/client.test.ts`
Expected: FAIL — `spotifyFetch` not exported.

- [ ] **Step 8: Implement client**

Create `src/lib/spotify/client.ts`:

```typescript
import { loadRefreshToken } from "@/lib/spotify/token-store";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export function __resetTokenCacheForTests(): void {
  cachedAccessToken = null;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Spotify client credentials missing");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }
  const stored = await loadRefreshToken();
  if (!stored) throw new Error("Spotify not authenticated");
  return refreshAccessToken(stored.refreshToken);
}

export async function spotifyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }
  let res = await fetch(url, { ...init, headers });

  // One retry on 401 (token revoked mid-flight)
  if (res.status === 401) {
    cachedAccessToken = null;
    const fresh = await getAccessToken();
    headers.set("Authorization", `Bearer ${fresh}`);
    res = await fetch(url, { ...init, headers });
  }
  return res;
}
```

- [ ] **Step 9: Run test, verify pass**

Run: `npm test -- tests/lib/spotify/client.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 10: Commit**

```bash
git add src/lib/spotify/token-store.ts src/lib/spotify/client.ts tests/lib/spotify/client.test.ts .env.example
git commit -m "feat(spotify): encrypted token store + HTTP client with refresh"
```

---

## Task 3: One-time OAuth flow (admin endpoints + UI)

**Files:**
- Create: `src/app/api/spotify/auth/start/route.ts`
- Create: `src/app/api/spotify/auth/callback/route.ts`
- Create: `src/app/dashboard/wa/spotify-auth/page.tsx`

- [ ] **Step 1: Create OAuth start endpoint**

Create `src/app/api/spotify/auth/start/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { randomBytes } from "node:crypto";

const SPOTIFY_AUTHORIZE = "https://accounts.spotify.com/authorize";
const SCOPES = "playlist-modify-public playlist-modify-private";

export async function GET(req: Request) {
  await requireAdminSession(req);
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Spotify env not configured" }, { status: 500 });
  }
  const state = randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
    show_dialog: "true",
  });
  const res = NextResponse.redirect(`${SPOTIFY_AUTHORIZE}?${params}`);
  res.cookies.set("spotify_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
  });
  return res;
}
```

Note: if `requireAdminSession` doesn't exist with that exact name, use the existing project pattern — read `src/lib/auth.ts` and adapt. The intent is to gate this endpoint to admins only.

- [ ] **Step 2: Create OAuth callback endpoint**

Create `src/app/api/spotify/auth/callback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { saveRefreshToken } from "@/lib/spotify/token-store";

const TOKEN_URL = "https://accounts.spotify.com/api/token";

export async function GET(req: Request) {
  await requireAdminSession(req);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith("spotify_oauth_state="))
    ?.split("=")[1];

  if (!code || !state || state !== cookieState) {
    return NextResponse.json({ error: "invalid state or code" }, { status: 400 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI!;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.json({ error: "token exchange failed" }, { status: 500 });
  }
  const data = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    scope: string;
  };

  // Get user id to remember which Spotify account owns the playlists
  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const me = (await meRes.json()) as { id: string };

  await saveRefreshToken(data.refresh_token, me.id, data.scope);

  return NextResponse.redirect(new URL("/dashboard/wa/spotify-auth?ok=1", req.url));
}
```

- [ ] **Step 3: Create admin UI page**

Create `src/app/dashboard/wa/spotify-auth/page.tsx`:

```tsx
import { db } from "@/lib/db";

export default async function SpotifyAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const params = await searchParams;
  const existing = await db.spotifyToken.findUnique({ where: { id: "singleton" } });

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-semibold mb-4">Spotify Authentication</h1>
      {params.ok === "1" && (
        <div className="bg-emerald-900/40 border border-emerald-700 text-emerald-200 px-4 py-2 rounded mb-4">
          Connected successfully.
        </div>
      )}
      {existing ? (
        <div className="space-y-3">
          <p className="text-zinc-300">
            Connected as Spotify user: <code>{existing.spotifyUserId}</code>
          </p>
          <p className="text-zinc-500 text-sm">
            Scopes: {existing.scope}
          </p>
          <a
            href="/api/spotify/auth/start"
            className="inline-block bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded text-sm"
          >
            Re-authenticate
          </a>
        </div>
      ) : (
        <a
          href="/api/spotify/auth/start"
          className="inline-block bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded"
        >
          Connect Spotify
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Manual smoke test**

1. Set env vars (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `SPOTIFY_TOKEN_ENCRYPTION_KEY`).
2. Register `http://localhost:3000/api/spotify/auth/callback` in Spotify Developer Dashboard.
3. Run `npm run dev`, visit `/dashboard/wa/spotify-auth`, click Connect Spotify.
4. Approve scopes. Should redirect back with `?ok=1`. Page should now show the connected user.
5. Verify `SpotifyToken` row exists in DB: `npx prisma studio`.

Expected: row with `spotifyUserId` = Ricardo's user, `scope` = `playlist-modify-public playlist-modify-private`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/spotify/auth src/app/dashboard/wa/spotify-auth
git commit -m "feat(spotify): OAuth one-time admin flow + connection status UI"
```

---

## Task 4: Daily cron — playlist creation skeleton

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `vercel.json`
- Create: `src/app/api/cron/spotify-playlists/route.ts`
- Create: `src/lib/spotify/playlist-manager.ts`
- Create: `tests/lib/spotify/playlist-manager.test.ts`

- [ ] **Step 1: Add `WaClassPlaylist` model**

Modify `prisma/schema.prisma`, append:

```prisma
model WaClassPlaylist {
  id                String   @id @default(cuid())
  yogoClassId       Int      @unique
  spotifyPlaylistId String
  createdAt         DateTime @default(now())
  requestCount      Int      @default(0)
  locked            Boolean  @default(false)
}
```

- [ ] **Step 2: Generate migration**

Run: `npx prisma migrate dev --name wa_class_playlist`
Expected: applied without errors.

- [ ] **Step 3: Write failing tests for playlist-manager.createClassPlaylist**

Create `tests/lib/spotify/playlist-manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createClassPlaylist } from "@/lib/spotify/playlist-manager";

describe("createClassPlaylist", () => {
  beforeEach(async () => {
    await db.waClassPlaylist.deleteMany();
    vi.restoreAllMocks();
  });

  it("creates a Spotify playlist, seeds 20 shuffled tracks, persists row", async () => {
    const apiCalls: { url: string; method: string; body?: any }[] = [];
    const mockTracks = Array.from({ length: 50 }, (_, i) => ({
      track: { uri: `spotify:track:base${i}` },
    }));
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      apiCalls.push({ url, method: init?.method ?? "GET", body: init?.body });
      if (url.includes("accounts.spotify.com")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      }
      if (url.includes("/playlists") && url.endsWith("/tracks") && (!init?.method || init.method === "GET")) {
        return new Response(JSON.stringify({ items: mockTracks, next: null }), { status: 200 });
      }
      if (url.includes("/users/") && url.endsWith("/playlists") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "newpl123" }), { status: 201 });
      }
      if (url.includes("/playlists/newpl123/tracks") && init?.method === "POST") {
        return new Response(JSON.stringify({ snapshot_id: "abc" }), { status: 201 });
      }
      return new Response("not mocked", { status: 500 });
    }) as any;

    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.SPOTIFY_BASE_PLAYLIST_ID = "basepl";

    // pre-seed refresh token
    const { saveRefreshToken } = await import("@/lib/spotify/token-store");
    await saveRefreshToken("rt", "user1", "playlist-modify-public");

    const result = await createClassPlaylist({
      yogoClassId: 999,
      className: "Muay Thai",
      startsAtIso: "2026-05-27T19:00:00Z",
    });

    expect(result.spotifyPlaylistId).toBe("newpl123");
    const persisted = await db.waClassPlaylist.findUnique({ where: { yogoClassId: 999 } });
    expect(persisted?.requestCount).toBe(0);
    expect(persisted?.locked).toBe(false);

    const addCall = apiCalls.find((c) => c.url.endsWith("/playlists/newpl123/tracks") && c.method === "POST");
    expect(addCall).toBeDefined();
    const body = JSON.parse(addCall!.body as string);
    expect(body.uris).toHaveLength(20);
    expect(body.position).toBe(0);
  });

  it("is idempotent — second call for same yogoClassId is a no-op", async () => {
    await db.waClassPlaylist.create({
      data: { yogoClassId: 555, spotifyPlaylistId: "existing" },
    });
    const result = await createClassPlaylist({
      yogoClassId: 555,
      className: "BJJ",
      startsAtIso: "2026-05-27T20:00:00Z",
    });
    expect(result.spotifyPlaylistId).toBe("existing");
    expect(result.created).toBe(false);
  });
});
```

- [ ] **Step 4: Run test, verify fail**

Run: `npm test -- tests/lib/spotify/playlist-manager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement playlist-manager.createClassPlaylist**

Create `src/lib/spotify/playlist-manager.ts`:

```typescript
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
```

- [ ] **Step 6: Run test, verify pass**

Run: `npm test -- tests/lib/spotify/playlist-manager.test.ts`
Expected: PASS (both tests).

- [ ] **Step 7: Create cron handler**

Create `src/app/api/cron/spotify-playlists/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listClasses } from "@/lib/yogo/signups";
import { createClassPlaylist } from "@/lib/spotify/playlist-manager";

// Verify request is from Vercel Cron (Authorization: Bearer ${CRON_SECRET})
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function isGroupClass(k: { class_type_id?: number; max_attendees?: number }): boolean {
  // Group classes have capacity > 1; PTs are 1:1. Fall back to a known
  // trial class type if needed (see business constants in CLAUDE.md).
  return (k.max_attendees ?? 0) > 1;
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return new NextResponse("unauthorized", { status: 401 });

  const today = isoDate(0);
  const tomorrow = isoDate(1);
  const all = (await listClasses(today, tomorrow)) as any[];
  const todays = all.filter(isGroupClass).filter((k) => k.start_time?.startsWith(today));

  const results: { yogoClassId: number; created: boolean; error?: string }[] = [];
  for (const k of todays) {
    try {
      const r = await createClassPlaylist({
        yogoClassId: k.id,
        className: k.class_type?.name ?? `Class ${k.id}`,
        startsAtIso: k.start_time,
      });
      results.push({ yogoClassId: k.id, created: r.created });
    } catch (err) {
      results.push({
        yogoClassId: k.id,
        created: false,
        error: err instanceof Error ? err.message : String(err),
      });
      await db.waEvent.create({
        data: {
          kind: "SPOTIFY_PLAYLIST_CREATE_FAIL",
          phoneE164: "system",
          payload: JSON.stringify({ yogoClassId: k.id, error: String(err) }),
        },
      });
    }
  }

  return NextResponse.json({ ok: true, total: todays.length, results });
}
```

Note: the `class_type` and `max_attendees` shape depends on the actual Yogo API response. Inspect `src/lib/yogo/signups.ts` and adapt the filter — the existing booking flow already distinguishes group vs PT, reuse its logic.

- [ ] **Step 8: Register cron in `vercel.json`**

Modify `vercel.json`, add entry to `crons`:

```json
{ "path": "/api/cron/spotify-playlists", "schedule": "0 4 * * *" }
```

Resulting file:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/trial-followup", "schedule": "0 10 * * *" },
    { "path": "/api/cron/trial-followup", "schedule": "0 11 * * *" },
    { "path": "/api/cron/wa-purge", "schedule": "0 3 * * *" },
    { "path": "/api/cron/spotify-playlists", "schedule": "0 4 * * *" }
  ]
}
```

- [ ] **Step 9: Manual smoke test**

Run: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/spotify-playlists`
Expected: JSON with `results` array; each successful entry has `created: true` on first run, `created: false` on second run (idempotent).
Verify in Spotify app: new playlists exist with 20 tracks each.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations vercel.json \
  src/lib/spotify/playlist-manager.ts \
  src/app/api/cron/spotify-playlists \
  tests/lib/spotify/playlist-manager.test.ts
git commit -m "feat(spotify): daily cron generates per-class playlists with 20 shuffled base tracks"
```

---

## Task 5: Playlist-manager — insert/remove/swap operations

**Files:**
- Modify: `src/lib/spotify/playlist-manager.ts`
- Modify: `tests/lib/spotify/playlist-manager.test.ts`

- [ ] **Step 1: Add tests for `insertSongAtNextPosition`**

Append to `tests/lib/spotify/playlist-manager.test.ts`:

```typescript
import { insertSongAtNextPosition, removeSongAndRecompress, swapSong } from "@/lib/spotify/playlist-manager";

describe("insertSongAtNextPosition", () => {
  beforeEach(async () => {
    await db.waSongRequest.deleteMany();
    await db.waClassPlaylist.deleteMany();
  });

  it("inserts at position = requestCount and increments counter atomically", async () => {
    await db.waClassPlaylist.create({
      data: { yogoClassId: 100, spotifyPlaylistId: "pl100", requestCount: 2 },
    });

    let receivedBody: any = null;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("accounts.spotify.com")) {
        return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      }
      if (url.endsWith("/playlists/pl100/tracks") && init?.method === "POST") {
        receivedBody = JSON.parse(init.body as string);
        return new Response(JSON.stringify({ snapshot_id: "s" }), { status: 201 });
      }
      return new Response("nope", { status: 500 });
    }) as any;

    const result = await insertSongAtNextPosition({
      yogoClassId: 100,
      trackUri: "spotify:track:xyz",
    });

    expect(result.position).toBe(2);
    expect(receivedBody.position).toBe(2);
    expect(receivedBody.uris).toEqual(["spotify:track:xyz"]);
    const after = await db.waClassPlaylist.findUnique({ where: { yogoClassId: 100 } });
    expect(after?.requestCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/lib/spotify/playlist-manager.test.ts -t insertSongAtNextPosition`
Expected: FAIL — `insertSongAtNextPosition` not exported.

- [ ] **Step 3: Implement `insertSongAtNextPosition`**

Append to `src/lib/spotify/playlist-manager.ts`:

```typescript
export interface InsertSongArgs {
  yogoClassId: number;
  trackUri: string;
}

export interface InsertSongResult {
  position: number;
}

export async function insertSongAtNextPosition(args: InsertSongArgs): Promise<InsertSongResult> {
  // Atomic increment-and-fetch via raw transaction to avoid race
  const playlist = await db.$transaction(async (tx) => {
    const updated = await tx.waClassPlaylist.update({
      where: { yogoClassId: args.yogoClassId },
      data: { requestCount: { increment: 1 } },
    });
    return updated;
  });
  const position = playlist.requestCount - 1;

  const res = await spotifyFetch(`/v1/playlists/${playlist.spotifyPlaylistId}/tracks`, {
    method: "POST",
    body: JSON.stringify({ uris: [args.trackUri], position }),
  });
  if (!res.ok) {
    // Rollback counter on Spotify failure
    await db.waClassPlaylist.update({
      where: { yogoClassId: args.yogoClassId },
      data: { requestCount: { decrement: 1 } },
    });
    throw new Error(`Spotify add track failed: ${res.status}`);
  }

  return { position };
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- tests/lib/spotify/playlist-manager.test.ts -t insertSongAtNextPosition`
Expected: PASS.

- [ ] **Step 5: Add tests for `removeSongAndRecompress`**

Append to test file:

```typescript
describe("removeSongAndRecompress", () => {
  it("deletes from Spotify, decrements requestCount, shifts higher positions down in DB", async () => {
    await db.waClassPlaylist.create({
      data: { yogoClassId: 200, spotifyPlaylistId: "pl200", requestCount: 3 },
    });
    await db.waContact.upsert({ where: { phoneE164: "+351900000001" }, create: { phoneE164: "+351900000001" }, update: {} });
    await db.waContact.upsert({ where: { phoneE164: "+351900000002" }, create: { phoneE164: "+351900000002" }, update: {} });
    await db.waContact.upsert({ where: { phoneE164: "+351900000003" }, create: { phoneE164: "+351900000003" }, update: {} });

    const r1 = await db.waSongRequest.create({
      data: { contactId: "+351900000001", yogoClassId: 200, spotifyTrackId: "t1", spotifyTrackName: "n1", spotifyArtistName: "a1", spotifyTrackUri: "spotify:track:t1", position: 0, status: "active" },
    });
    const r2 = await db.waSongRequest.create({
      data: { contactId: "+351900000002", yogoClassId: 200, spotifyTrackId: "t2", spotifyTrackName: "n2", spotifyArtistName: "a2", spotifyTrackUri: "spotify:track:t2", position: 1, status: "active" },
    });
    const r3 = await db.waSongRequest.create({
      data: { contactId: "+351900000003", yogoClassId: 200, spotifyTrackId: "t3", spotifyTrackName: "n3", spotifyArtistName: "a3", spotifyTrackUri: "spotify:track:t3", position: 2, status: "active" },
    });

    let deleteBody: any = null;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("accounts.spotify.com")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      if (url.endsWith("/playlists/pl200/tracks") && init?.method === "DELETE") {
        deleteBody = JSON.parse(init.body as string);
        return new Response(JSON.stringify({ snapshot_id: "s" }), { status: 200 });
      }
      return new Response("nope", { status: 500 });
    }) as any;

    await removeSongAndRecompress(r1.id);

    expect(deleteBody.tracks).toEqual([{ uri: "spotify:track:t1" }]);
    const after1 = await db.waSongRequest.findUnique({ where: { id: r1.id } });
    const after2 = await db.waSongRequest.findUnique({ where: { id: r2.id } });
    const after3 = await db.waSongRequest.findUnique({ where: { id: r3.id } });
    expect(after1?.status).toBe("cancelled_by_unbook");
    expect(after2?.position).toBe(0);
    expect(after3?.position).toBe(1);

    const playlist = await db.waClassPlaylist.findUnique({ where: { yogoClassId: 200 } });
    expect(playlist?.requestCount).toBe(2);
  });
});
```

Note: this test depends on `WaSongRequest` Prisma model existing. It will be created in Task 6. Steps 5-8 should be executed AFTER Task 6 step 1-2 so the model exists. Alternatively, run Task 6 first; the ordering is flexible but the model must exist before this test compiles.

- [ ] **Step 6: Implement `removeSongAndRecompress`**

Append to `src/lib/spotify/playlist-manager.ts`:

```typescript
export async function removeSongAndRecompress(songRequestId: string): Promise<void> {
  const req = await db.waSongRequest.findUnique({ where: { id: songRequestId } });
  if (!req || req.status !== "active") return;

  const playlist = await db.waClassPlaylist.findUnique({
    where: { yogoClassId: req.yogoClassId },
  });
  if (!playlist) return;

  // Remove from Spotify — auto-compacts positions there
  const res = await spotifyFetch(`/v1/playlists/${playlist.spotifyPlaylistId}/tracks`, {
    method: "DELETE",
    body: JSON.stringify({ tracks: [{ uri: req.spotifyTrackUri }] }),
  });
  if (!res.ok) throw new Error(`Spotify delete failed: ${res.status}`);

  // Update DB in a transaction
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
```

- [ ] **Step 7: Run test, verify pass**

Run: `npm test -- tests/lib/spotify/playlist-manager.test.ts -t removeSongAndRecompress`
Expected: PASS.

- [ ] **Step 8: Add `swapSong` test + impl**

Append test:

```typescript
describe("swapSong", () => {
  it("removes old URI from Spotify, inserts new at SAME position, marks old as swapped", async () => {
    await db.waClassPlaylist.create({
      data: { yogoClassId: 300, spotifyPlaylistId: "pl300", requestCount: 1 },
    });
    await db.waContact.upsert({ where: { phoneE164: "+351900000010" }, create: { phoneE164: "+351900000010" }, update: {} });
    const old = await db.waSongRequest.create({
      data: { contactId: "+351900000010", yogoClassId: 300, spotifyTrackId: "old", spotifyTrackName: "n", spotifyArtistName: "a", spotifyTrackUri: "spotify:track:old", position: 0, status: "active" },
    });

    const ops: any[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("accounts.spotify.com")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      if (url.endsWith("/playlists/pl300/tracks")) {
        ops.push({ method: init?.method, body: init?.body && JSON.parse(init.body as string) });
        return new Response(JSON.stringify({ snapshot_id: "s" }), { status: 200 });
      }
      return new Response("nope", { status: 500 });
    }) as any;

    const result = await swapSong({
      oldRequestId: old.id,
      newTrackUri: "spotify:track:new",
      newTrackId: "new",
      newTrackName: "newName",
      newArtistName: "newArtist",
      contactId: "+351900000010",
    });

    expect(result.position).toBe(0);
    expect(ops.some((o) => o.method === "DELETE" && o.body.tracks[0].uri === "spotify:track:old")).toBe(true);
    expect(ops.some((o) => o.method === "POST" && o.body.position === 0 && o.body.uris[0] === "spotify:track:new")).toBe(true);

    const updatedOld = await db.waSongRequest.findUnique({ where: { id: old.id } });
    expect(updatedOld?.status).toBe("swapped");
    const after = await db.waClassPlaylist.findUnique({ where: { yogoClassId: 300 } });
    expect(after?.requestCount).toBe(1); // unchanged: swap doesn't add a slot
  });
});
```

Append impl:

```typescript
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

  // Delete old from Spotify
  const delRes = await spotifyFetch(`/v1/playlists/${playlist.spotifyPlaylistId}/tracks`, {
    method: "DELETE",
    body: JSON.stringify({ tracks: [{ uri: old.spotifyTrackUri }] }),
  });
  if (!delRes.ok) throw new Error(`Spotify delete failed: ${delRes.status}`);

  // Insert new at same position
  const addRes = await spotifyFetch(`/v1/playlists/${playlist.spotifyPlaylistId}/tracks`, {
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
```

- [ ] **Step 9: Run all playlist-manager tests, verify pass**

Run: `npm test -- tests/lib/spotify/playlist-manager.test.ts`
Expected: PASS — all 5 tests (create×2, insert, remove, swap).

- [ ] **Step 10: Commit**

```bash
git add src/lib/spotify/playlist-manager.ts tests/lib/spotify/playlist-manager.test.ts
git commit -m "feat(spotify): insert/remove/swap playlist operations with FIFO position management"
```

---

## Task 6: Prisma — WaSongRequest model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add model**

Append to `prisma/schema.prisma`:

```prisma
model WaSongRequest {
  id                 String   @id @default(cuid())
  contactId          String
  yogoClassId        Int
  spotifyTrackId     String
  spotifyTrackName   String
  spotifyArtistName  String
  spotifyTrackUri    String
  position           Int
  status             String   // active | cancelled_by_unbook | swapped | rejected_genre | rejected_artist | rejected_window
  rejectedReason     String?
  createdAt          DateTime @default(now())

  @@index([contactId, yogoClassId])
  @@index([yogoClassId, status])
}
```

- [ ] **Step 2: Generate migration**

Run: `npx prisma migrate dev --name wa_song_request`
Expected: applied without errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(wa): add WaSongRequest model"
```

---

## Task 7: Genre filter + blocklist tables + seed

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/seed/seed-blocked-genres.ts`
- Modify: `package.json` (add seed script)
- Create: `src/lib/spotify/genre-filter.ts`
- Create: `tests/lib/spotify/genre-filter.test.ts`

- [ ] **Step 1: Add models**

Append to `prisma/schema.prisma`:

```prisma
model WaBlockedGenre {
  id        String   @id @default(cuid())
  keyword   String   @unique
  addedBy   String
  addedAt   DateTime @default(now())
  active    Boolean  @default(true)
}

model WaBlockedArtist {
  spotifyArtistId String   @id
  artistName      String
  reason          String?
  addedBy         String
  addedAt         DateTime @default(now())
}
```

- [ ] **Step 2: Generate migration**

Run: `npx prisma migrate dev --name wa_blocklists`
Expected: applied.

- [ ] **Step 3: Create seed script**

Create `prisma/seed/seed-blocked-genres.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const SEED_KEYWORDS = [
  "funk carioca", "funk ostentação", "funk mtg", "funk 150",
  "funk melody", "brega funk", "funk consciente",
  "pagode", "samba pagode",
  "axé", "axe music",
  "forró eletrônico", "forro eletronico", "forró pé de serra",
  "sertanejo universitário", "sertanejo romântico", "modão",
  "pisadinha", "brega",
  "pimba", "kizomba", "tarraxinha", "fado", "morna",
  "bossa nova", "smooth jazz",
  "lullaby", "children's music", "kids music",
  "meditation", "sleep", "ambient sleep",
  "karaoke", "worship", "christian worship",
];

async function main() {
  const db = new PrismaClient();
  for (const kw of SEED_KEYWORDS) {
    await db.waBlockedGenre.upsert({
      where: { keyword: kw },
      create: { keyword: kw, addedBy: "system-seed" },
      update: {},
    });
  }
  console.log(`Seeded ${SEED_KEYWORDS.length} blocked genres.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Add seed script to `package.json`**

Add to `scripts`:

```json
"seed:blocked-genres": "tsx prisma/seed/seed-blocked-genres.ts"
```

- [ ] **Step 5: Run seed**

Run: `npm run seed:blocked-genres`
Expected: `Seeded 34 blocked genres.`
Verify: `npx prisma studio` → `WaBlockedGenre` has 34 rows.

- [ ] **Step 6: Write failing tests for genre-filter**

Create `tests/lib/spotify/genre-filter.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { evaluateTrack } from "@/lib/spotify/genre-filter";

describe("evaluateTrack", () => {
  beforeEach(async () => {
    await db.waBlockedGenre.deleteMany();
    await db.waBlockedArtist.deleteMany();
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    const { saveRefreshToken } = await import("@/lib/spotify/token-store");
    await saveRefreshToken("rt", "u1", "playlist-modify-public");
    vi.restoreAllMocks();
  });

  function mockSpotify(track: any, artists: Record<string, { genres: string[]; name: string }>) {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("accounts.spotify.com")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      if (url.includes("/v1/tracks/")) return new Response(JSON.stringify(track), { status: 200 });
      if (url.includes("/v1/artists?ids=")) {
        const ids = new URL(url).searchParams.get("ids")!.split(",");
        return new Response(JSON.stringify({ artists: ids.map((id) => ({ id, ...artists[id] })) }), { status: 200 });
      }
      return new Response("nope", { status: 500 });
    }) as any;
  }

  it("accepts a rock track", async () => {
    await db.waBlockedGenre.create({ data: { keyword: "pagode", addedBy: "test" } });
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
    await db.waBlockedGenre.create({ data: { keyword: "funk carioca", addedBy: "test" } });
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
    await db.waBlockedArtist.create({
      data: { spotifyArtistId: "badArt", artistName: "Bad Artist", addedBy: "test" },
    });
    mockSpotify(
      { id: "t3", name: "Foo", uri: "spotify:track:t3", artists: [{ id: "badArt" }] },
      { badArt: { name: "Bad Artist", genres: ["jazz"] } }
    );
    const result = await evaluateTrack("t3");
    expect(result.outcome).toBe("reject_artist");
  });

  it("rejects when ANY artist on a multi-artist track is blocked", async () => {
    await db.waBlockedGenre.create({ data: { keyword: "pagode", addedBy: "test" } });
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
    mockSpotify(
      { id: "t5", name: "Unknown Indie", uri: "spotify:track:t5", artists: [{ id: "indie" }] },
      { indie: { name: "Indie", genres: [] } }
    );
    const result = await evaluateTrack("t5");
    expect(result.outcome).toBe("accept");
  });

  it("ignores inactive blocklist entries", async () => {
    await db.waBlockedGenre.create({
      data: { keyword: "rock", addedBy: "test", active: false },
    });
    mockSpotify(
      { id: "t6", name: "Foo", uri: "spotify:track:t6", artists: [{ id: "a" }] },
      { a: { name: "A", genres: ["rock"] } }
    );
    const result = await evaluateTrack("t6");
    expect(result.outcome).toBe("accept");
  });
});
```

- [ ] **Step 7: Run test, verify fail**

Run: `npm test -- tests/lib/spotify/genre-filter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 8: Implement genre-filter**

Create `src/lib/spotify/genre-filter.ts`:

```typescript
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
          artistName: primaryArtistName,
        };
      }
    }
  }

  return {
    outcome: "accept",
    trackId: track.id,
    trackName: track.name,
    trackUri: track.uri,
    artistName: primaryArtistName,
    artistIds,
  };
}
```

- [ ] **Step 9: Run test, verify pass**

Run: `npm test -- tests/lib/spotify/genre-filter.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed package.json \
  src/lib/spotify/genre-filter.ts \
  tests/lib/spotify/genre-filter.test.ts
git commit -m "feat(spotify): genre/artist blocklist filter + initial seed"
```

---

## Task 8: Spotify URL parser + new WA session states

**Files:**
- Modify: `src/lib/wa/parser.ts`
- Modify: `src/lib/wa/session.ts`
- Create: `tests/lib/wa/parser-spotify.test.ts`

- [ ] **Step 1: Write failing tests for `parseSpotifyTrackId`**

Create `tests/lib/wa/parser-spotify.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseSpotifyTrackId } from "@/lib/wa/parser";

describe("parseSpotifyTrackId", () => {
  it("extracts ID from open.spotify.com track URL", () => {
    expect(parseSpotifyTrackId("https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv"))
      .toBe("4u7EnebtmKWzUH433cf5Qv");
  });

  it("extracts ID from open.spotify.com URL with si= query", () => {
    expect(
      parseSpotifyTrackId(
        "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv?si=abc123"
      )
    ).toBe("4u7EnebtmKWzUH433cf5Qv");
  });

  it("extracts ID from open.spotify.com URL with locale prefix", () => {
    expect(
      parseSpotifyTrackId("https://open.spotify.com/intl-pt/track/4u7EnebtmKWzUH433cf5Qv")
    ).toBe("4u7EnebtmKWzUH433cf5Qv");
  });

  it("extracts ID from spotify URI", () => {
    expect(parseSpotifyTrackId("spotify:track:4u7EnebtmKWzUH433cf5Qv"))
      .toBe("4u7EnebtmKWzUH433cf5Qv");
  });

  it("returns null for non-track URLs (album, playlist)", () => {
    expect(parseSpotifyTrackId("https://open.spotify.com/album/abc")).toBeNull();
    expect(parseSpotifyTrackId("https://open.spotify.com/playlist/abc")).toBeNull();
  });

  it("returns null for free text", () => {
    expect(parseSpotifyTrackId("Bohemian Rhapsody")).toBeNull();
    expect(parseSpotifyTrackId("")).toBeNull();
  });

  it("finds Spotify link inside surrounding text", () => {
    expect(
      parseSpotifyTrackId("tira esta https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv ya")
    ).toBe("4u7EnebtmKWzUH433cf5Qv");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/lib/wa/parser-spotify.test.ts`
Expected: FAIL — `parseSpotifyTrackId` not exported.

- [ ] **Step 3: Implement parser**

Append to `src/lib/wa/parser.ts`:

```typescript
const SPOTIFY_TRACK_URL_RE = /https?:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]+)/;
const SPOTIFY_TRACK_URI_RE = /spotify:track:([a-zA-Z0-9]+)/;

export function parseSpotifyTrackId(input: string): string | null {
  if (!input) return null;
  const urlMatch = input.match(SPOTIFY_TRACK_URL_RE);
  if (urlMatch) return urlMatch[1];
  const uriMatch = input.match(SPOTIFY_TRACK_URI_RE);
  if (uriMatch) return uriMatch[1];
  return null;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- tests/lib/wa/parser-spotify.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Extend session states**

Modify `src/lib/wa/session.ts`. Change the `WaSessionState` union:

```typescript
export type WaSessionState =
  | "IDLE"
  | "AWAIT_CLASS_PICK"
  | "AWAIT_CONFIRM_BOOK"
  | "AWAIT_CANCEL_PICK"
  | "AWAIT_CONFIRM_CANCEL"
  | "AWAIT_SONG_INPUT"
  | "AWAIT_SONG_CONFIRM"
  | "AWAIT_SWAP_CONFIRM";
```

- [ ] **Step 6: Add `pendingSongClassId` and `pendingTrackId` columns**

The existing `SessionRow` has `pendingClassId` and `pendingSignupId`. Add two new fields. Modify the `WaSession` model in `prisma/schema.prisma`:

```prisma
model WaSession {
  // ... existing fields
  pendingSongClassId Int?
  pendingTrackId     String?
}
```

(Exact field list: read the current model first and append these two fields. Do not remove anything.)

- [ ] **Step 7: Generate migration**

Run: `npx prisma migrate dev --name wa_session_song_fields`
Expected: applied.

- [ ] **Step 8: Update `SessionRow` interface and `TransitionPatch` in session.ts**

```typescript
export interface SessionRow {
  phoneE164: string;
  state: string;
  pendingClassId: number | null;
  pendingSignupId: number | null;
  pendingSongClassId: number | null;
  pendingTrackId: string | null;
  expiresAt: Date | null;
  version: number;
}

export interface TransitionPatch {
  state?: WaSessionState;
  pendingClassId?: number | null;
  pendingSignupId?: number | null;
  pendingSongClassId?: number | null;
  pendingTrackId?: string | null;
  expiresAt?: Date | null;
}
```

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations \
  src/lib/wa/parser.ts src/lib/wa/session.ts \
  tests/lib/wa/parser-spotify.test.ts
git commit -m "feat(wa): parseSpotifyTrackId + song-request session states"
```

---

## Task 9: Song-request handler — post-booking offer flow

**Files:**
- Create: `src/lib/wa/handlers/song-request.ts`
- Create: `tests/lib/wa/song-request.test.ts`
- Modify: `src/lib/wa/handlers/reservar.ts`

- [ ] **Step 1: Write failing tests for `offerSongRequest`**

Create `tests/lib/wa/song-request.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { offerSongRequest } from "@/lib/wa/handlers/song-request";

describe("offerSongRequest", () => {
  beforeEach(async () => {
    await db.waSongRequest.deleteMany();
    await db.waClassPlaylist.deleteMany();
    await db.waSession.deleteMany();
    await db.waContact.deleteMany();
    vi.restoreAllMocks();
  });

  it("does nothing if no playlist exists for the class", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000020" } });
    const sentTexts: string[] = [];
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockImplementation(
      async (_to: string, body: string) => {
        sentTexts.push(body);
        return { ok: true } as any;
      }
    );
    await offerSongRequest("+351900000020", 999);
    expect(sentTexts).toHaveLength(0);
  });

  it("sends offer text and transitions to AWAIT_SONG_INPUT when playlist exists", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000021" } });
    await db.waSession.create({ data: { phoneE164: "+351900000021" } });
    await db.waClassPlaylist.create({
      data: { yogoClassId: 800, spotifyPlaylistId: "pl800" },
    });
    const sentTexts: string[] = [];
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockImplementation(
      async (_to: string, body: string) => {
        sentTexts.push(body);
        return { ok: true } as any;
      }
    );

    await offerSongRequest("+351900000021", 800);

    expect(sentTexts).toHaveLength(1);
    expect(sentTexts[0]).toMatch(/m[uú]sica/i);
    const session = await db.waSession.findUnique({ where: { phoneE164: "+351900000021" } });
    expect(session?.state).toBe("AWAIT_SONG_INPUT");
    expect(session?.pendingSongClassId).toBe(800);
  });

  it("skips if aluno already has an active request for this class", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000022" } });
    await db.waSession.create({ data: { phoneE164: "+351900000022" } });
    await db.waClassPlaylist.create({
      data: { yogoClassId: 801, spotifyPlaylistId: "pl801" },
    });
    await db.waSongRequest.create({
      data: {
        contactId: "+351900000022",
        yogoClassId: 801,
        spotifyTrackId: "tt",
        spotifyTrackName: "n",
        spotifyArtistName: "a",
        spotifyTrackUri: "spotify:track:tt",
        position: 0,
        status: "active",
      },
    });
    const sentTexts: string[] = [];
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockImplementation(
      async (_to: string, body: string) => {
        sentTexts.push(body);
        return { ok: true } as any;
      }
    );

    await offerSongRequest("+351900000022", 801);
    expect(sentTexts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/lib/wa/song-request.test.ts -t offerSongRequest`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `offerSongRequest`**

Create `src/lib/wa/handlers/song-request.ts`:

```typescript
import { db } from "@/lib/db";
import { sendText } from "@/lib/wa/meta";
import { loadSession, transition, ttlFromNow } from "@/lib/wa/session";

const OFFER_TEXT =
  "Queres pedir uma música para esta aula? Manda o link do Spotify ou diz 'não' para ignorar.";

export async function offerSongRequest(phoneE164: string, yogoClassId: number): Promise<void> {
  const playlist = await db.waClassPlaylist.findUnique({ where: { yogoClassId } });
  if (!playlist || playlist.locked) return;

  const existing = await db.waSongRequest.findFirst({
    where: { contactId: phoneE164, yogoClassId, status: "active" },
  });
  if (existing) return;

  const session = await loadSession(phoneE164);
  const t = await transition(session, {
    state: "AWAIT_SONG_INPUT",
    pendingSongClassId: yogoClassId,
    expiresAt: ttlFromNow(),
  });
  if (!t.ok) return;

  await sendText(phoneE164, OFFER_TEXT);
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- tests/lib/wa/song-request.test.ts -t offerSongRequest`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Hook into `handleReservar` after booking confirmation**

Modify `src/lib/wa/handlers/reservar.ts`. Find the spot AFTER the booking is successfully confirmed and the success message is sent (search for `BOOKED_OK` usage). Add a call to `offerSongRequest`:

```typescript
import { offerSongRequest } from "@/lib/wa/handlers/song-request";

// ... in the handler, after the BOOKED_OK message is sent and BEFORE returning to IDLE:
await offerSongRequest(session.phoneE164, classIdThatWasBooked);
```

Note: locate the exact spot by reading the current `reservar.ts` — the booking confirmation lives in the `AWAIT_CONFIRM_BOOK` branch. The class id is in `session.pendingClassId` (or the equivalent variable that holds the just-booked class).

- [ ] **Step 6: Commit**

```bash
git add src/lib/wa/handlers/song-request.ts src/lib/wa/handlers/reservar.ts \
  tests/lib/wa/song-request.test.ts
git commit -m "feat(wa): offer song request after booking confirmation"
```

---

## Task 10: Song-request handler — process input + accept/reject

**Files:**
- Modify: `src/lib/wa/handlers/song-request.ts`
- Modify: `tests/lib/wa/song-request.test.ts`
- Modify: `src/app/api/whatsapp/webhook/route.ts` (dispatch)

- [ ] **Step 1: Write failing tests for `handleSongInput`**

Append to `tests/lib/wa/song-request.test.ts`:

```typescript
import { handleSongInput } from "@/lib/wa/handlers/song-request";
import type { SessionRow } from "@/lib/wa/session";

function fakeSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    phoneE164: "+351900000030",
    state: "AWAIT_SONG_INPUT",
    pendingClassId: null,
    pendingSignupId: null,
    pendingSongClassId: 1000,
    pendingTrackId: null,
    expiresAt: new Date(Date.now() + 60000),
    version: 0,
    ...overrides,
  };
}

describe("handleSongInput", () => {
  beforeEach(async () => {
    await db.waSongRequest.deleteMany();
    await db.waClassPlaylist.deleteMany();
    await db.waSession.deleteMany();
    await db.waContact.deleteMany();
    await db.waBlockedGenre.deleteMany();
    await db.waBlockedArtist.deleteMany();
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    const { saveRefreshToken } = await import("@/lib/spotify/token-store");
    await saveRefreshToken("rt", "u1", "playlist-modify-public");
    vi.restoreAllMocks();
  });

  it("replies with rejection when track genre is blocked", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000030" } });
    await db.waSession.create({
      data: { phoneE164: "+351900000030", state: "AWAIT_SONG_INPUT", pendingSongClassId: 1000 },
    });
    await db.waClassPlaylist.create({ data: { yogoClassId: 1000, spotifyPlaylistId: "pl1000" } });
    await db.waBlockedGenre.create({ data: { keyword: "funk carioca", addedBy: "t" } });

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("accounts.spotify.com")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      if (url.includes("/v1/tracks/")) return new Response(JSON.stringify({
        id: "abc", name: "Som", uri: "spotify:track:abc", artists: [{ id: "mc", name: "MC" }],
      }), { status: 200 });
      if (url.includes("/v1/artists?ids=")) return new Response(JSON.stringify({
        artists: [{ id: "mc", name: "MC", genres: ["funk carioca"] }],
      }), { status: 200 });
      return new Response("nope", { status: 500 });
    }) as any;

    const sentTexts: string[] = [];
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockImplementation(
      async (_to: string, body: string) => {
        sentTexts.push(body);
        return { ok: true } as any;
      }
    );

    const session = await db.waSession.findUnique({ where: { phoneE164: "+351900000030" } });
    await handleSongInput(session as any, "https://open.spotify.com/track/abc");

    expect(sentTexts.some((t) => t.includes("funk carioca"))).toBe(true);
    const persistedRej = await db.waSongRequest.findFirst({ where: { contactId: "+351900000030" } });
    expect(persistedRej?.status).toBe("rejected_genre");
    const after = await db.waSession.findUnique({ where: { phoneE164: "+351900000030" } });
    expect(after?.state).toBe("IDLE");
  });

  it("replies with confirmation prompt when track is acceptable and stores pendingTrackId", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000031" } });
    await db.waSession.create({
      data: { phoneE164: "+351900000031", state: "AWAIT_SONG_INPUT", pendingSongClassId: 1001 },
    });
    await db.waClassPlaylist.create({ data: { yogoClassId: 1001, spotifyPlaylistId: "pl1001" } });

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("accounts.spotify.com")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      if (url.includes("/v1/tracks/")) return new Response(JSON.stringify({
        id: "boh", name: "Bohemian Rhapsody", uri: "spotify:track:boh",
        artists: [{ id: "queen", name: "Queen" }],
      }), { status: 200 });
      if (url.includes("/v1/artists?ids=")) return new Response(JSON.stringify({
        artists: [{ id: "queen", name: "Queen", genres: ["rock"] }],
      }), { status: 200 });
      return new Response("nope", { status: 500 });
    }) as any;

    const sentTexts: string[] = [];
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockImplementation(
      async (_to: string, body: string) => {
        sentTexts.push(body);
        return { ok: true } as any;
      }
    );

    const session = await db.waSession.findUnique({ where: { phoneE164: "+351900000031" } });
    await handleSongInput(session as any, "https://open.spotify.com/track/boh");

    expect(sentTexts.some((t) => t.includes("Bohemian Rhapsody") && t.includes("Queen"))).toBe(true);
    const after = await db.waSession.findUnique({ where: { phoneE164: "+351900000031" } });
    expect(after?.state).toBe("AWAIT_SONG_CONFIRM");
    expect(after?.pendingTrackId).toBe("boh");
  });

  it("on user reply 'não' returns session to IDLE without rejecting", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000032" } });
    await db.waSession.create({
      data: { phoneE164: "+351900000032", state: "AWAIT_SONG_INPUT", pendingSongClassId: 1002 },
    });
    await db.waClassPlaylist.create({ data: { yogoClassId: 1002, spotifyPlaylistId: "pl1002" } });
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockResolvedValue({ ok: true } as any);

    const session = await db.waSession.findUnique({ where: { phoneE164: "+351900000032" } });
    await handleSongInput(session as any, "não");

    const after = await db.waSession.findUnique({ where: { phoneE164: "+351900000032" } });
    expect(after?.state).toBe("IDLE");
    const reqs = await db.waSongRequest.findMany();
    expect(reqs).toHaveLength(0);
  });

  it("on unparseable input, replies with usage hint and stays in AWAIT_SONG_INPUT", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000033" } });
    await db.waSession.create({
      data: { phoneE164: "+351900000033", state: "AWAIT_SONG_INPUT", pendingSongClassId: 1003 },
    });
    const sentTexts: string[] = [];
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockImplementation(
      async (_to: string, body: string) => {
        sentTexts.push(body);
        return { ok: true } as any;
      }
    );

    const session = await db.waSession.findUnique({ where: { phoneE164: "+351900000033" } });
    await handleSongInput(session as any, "Bohemian Rhapsody");

    expect(sentTexts.some((t) => t.toLowerCase().includes("link"))).toBe(true);
    const after = await db.waSession.findUnique({ where: { phoneE164: "+351900000033" } });
    expect(after?.state).toBe("AWAIT_SONG_INPUT");
  });

  it("rejects if window is closed (locked playlist)", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000034" } });
    await db.waSession.create({
      data: { phoneE164: "+351900000034", state: "AWAIT_SONG_INPUT", pendingSongClassId: 1004 },
    });
    await db.waClassPlaylist.create({
      data: { yogoClassId: 1004, spotifyPlaylistId: "pl1004", locked: true },
    });
    const sentTexts: string[] = [];
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockImplementation(
      async (_to: string, body: string) => {
        sentTexts.push(body);
        return { ok: true } as any;
      }
    );

    const session = await db.waSession.findUnique({ where: { phoneE164: "+351900000034" } });
    await handleSongInput(session as any, "https://open.spotify.com/track/abc");

    expect(sentTexts.some((t) => t.toLowerCase().includes("10 min"))).toBe(true);
    const reqs = await db.waSongRequest.findMany();
    expect(reqs[0]?.status).toBe("rejected_window");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/lib/wa/song-request.test.ts -t handleSongInput`
Expected: FAIL — `handleSongInput` not exported.

- [ ] **Step 3: Implement `handleSongInput`**

Append to `src/lib/wa/handlers/song-request.ts`:

```typescript
import { parseSpotifyTrackId } from "@/lib/wa/parser";
import { evaluateTrack } from "@/lib/spotify/genre-filter";
import { resetToIdle, type SessionRow } from "@/lib/wa/session";

const HINT_TEXT = "Manda o link do Spotify da música (ex: https://open.spotify.com/track/...) ou diz 'não' para ignorar.";
const WINDOW_CLOSED = "Esta aula já começou há mais de 10 min — pedidos fechados.";

export async function handleSongInput(session: SessionRow, body: string): Promise<void> {
  const phoneE164 = session.phoneE164;
  const text = body.trim().toLowerCase();

  if (text === "não" || text === "nao" || text === "no" || text === "n") {
    await resetToIdle(session);
    return;
  }

  const trackId = parseSpotifyTrackId(body);
  if (!trackId) {
    await sendText(phoneE164, HINT_TEXT);
    return;
  }

  if (!session.pendingSongClassId) {
    await resetToIdle(session);
    return;
  }
  const yogoClassId = session.pendingSongClassId;

  const playlist = await db.waClassPlaylist.findUnique({ where: { yogoClassId } });
  if (!playlist) {
    await resetToIdle(session);
    return;
  }
  if (playlist.locked) {
    await db.waSongRequest.create({
      data: {
        contactId: phoneE164,
        yogoClassId,
        spotifyTrackId: trackId,
        spotifyTrackName: "(window closed)",
        spotifyArtistName: "(window closed)",
        spotifyTrackUri: `spotify:track:${trackId}`,
        position: -1,
        status: "rejected_window",
        rejectedReason: "playlist locked",
      },
    });
    await sendText(phoneE164, WINDOW_CLOSED);
    await resetToIdle(session);
    return;
  }

  const result = await evaluateTrack(trackId);

  if (result.outcome === "reject_genre") {
    await db.waSongRequest.create({
      data: {
        contactId: phoneE164,
        yogoClassId,
        spotifyTrackId: trackId,
        spotifyTrackName: result.trackName,
        spotifyArtistName: result.artistName,
        spotifyTrackUri: `spotify:track:${trackId}`,
        position: -1,
        status: "rejected_genre",
        rejectedReason: result.matchedKeyword,
      },
    });
    await sendText(
      phoneE164,
      `Esta música é classificada como ${result.matchedKeyword} pelo Spotify. A casa só toca rock, hip-hop, rap e pop. Tenta outra 🥷`
    );
    await resetToIdle(session);
    return;
  }

  if (result.outcome === "reject_artist") {
    await db.waSongRequest.create({
      data: {
        contactId: phoneE164,
        yogoClassId,
        spotifyTrackId: trackId,
        spotifyTrackName: result.trackName,
        spotifyArtistName: result.artistName,
        spotifyTrackUri: `spotify:track:${trackId}`,
        position: -1,
        status: "rejected_artist",
        rejectedReason: result.blockedArtistName,
      },
    });
    await sendText(
      phoneE164,
      `O artista ${result.blockedArtistName} está bloqueado. Tenta outra música 🥷`
    );
    await resetToIdle(session);
    return;
  }

  // Accept → ask for confirmation
  const t = await transition(session, {
    state: "AWAIT_SONG_CONFIRM",
    pendingTrackId: result.trackId,
    expiresAt: ttlFromNow(),
  });
  if (!t.ok) return;

  await sendText(
    phoneE164,
    `Vais ouvir ${result.trackName} — ${result.artistName} 🎵\nConfirmar? (sim/não)`
  );
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- tests/lib/wa/song-request.test.ts -t handleSongInput`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Dispatch routing — route AWAIT_SONG_INPUT to handleSongInput**

Locate the dispatch logic — likely in `src/app/api/whatsapp/webhook/route.ts` or `src/lib/wa/dispatch.ts`. Look for the state switch that routes to `handleReservar`, `handleCancelar`, etc. Add cases for the new states:

```typescript
import { handleSongInput, handleSongConfirm } from "@/lib/wa/handlers/song-request";

// inside the state switch:
case "AWAIT_SONG_INPUT":
  await handleSongInput(session, messageBody);
  return;
case "AWAIT_SONG_CONFIRM":
  await handleSongConfirm(session, messageBody);
  return;
```

(`handleSongConfirm` is implemented in Task 11. Add a stub for now if Task 11 hasn't run yet.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/wa/handlers/song-request.ts src/app/api/whatsapp/webhook/route.ts \
  src/lib/wa/dispatch.ts tests/lib/wa/song-request.test.ts
git commit -m "feat(wa): handle song input, validate, accept/reject + dispatch routing"
```

---

## Task 11: Song-request handler — confirm + insert into playlist

**Files:**
- Modify: `src/lib/wa/handlers/song-request.ts`
- Modify: `tests/lib/wa/song-request.test.ts`

- [ ] **Step 1: Write failing tests for `handleSongConfirm`**

Append to `tests/lib/wa/song-request.test.ts`:

```typescript
import { handleSongConfirm } from "@/lib/wa/handlers/song-request";

describe("handleSongConfirm", () => {
  beforeEach(async () => {
    await db.waSongRequest.deleteMany();
    await db.waClassPlaylist.deleteMany();
    await db.waSession.deleteMany();
    await db.waContact.deleteMany();
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    const { saveRefreshToken } = await import("@/lib/spotify/token-store");
    await saveRefreshToken("rt", "u1", "playlist-modify-public");
    vi.restoreAllMocks();
  });

  it("on 'sim' inserts at requestCount position and resets to IDLE", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000040" } });
    await db.waSession.create({
      data: {
        phoneE164: "+351900000040",
        state: "AWAIT_SONG_CONFIRM",
        pendingSongClassId: 1100,
        pendingTrackId: "boh",
      },
    });
    await db.waClassPlaylist.create({
      data: { yogoClassId: 1100, spotifyPlaylistId: "pl1100", requestCount: 0 },
    });

    const apiCalls: any[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      apiCalls.push({ url, method: init?.method });
      if (url.includes("accounts.spotify.com")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      if (url.includes("/v1/tracks/")) return new Response(JSON.stringify({
        id: "boh", name: "Bohemian Rhapsody", uri: "spotify:track:boh",
        artists: [{ id: "queen", name: "Queen" }],
      }), { status: 200 });
      if (url.endsWith("/playlists/pl1100/tracks") && init?.method === "POST") {
        return new Response(JSON.stringify({ snapshot_id: "s" }), { status: 201 });
      }
      return new Response("nope", { status: 500 });
    }) as any;
    const sentTexts: string[] = [];
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockImplementation(
      async (_to: string, body: string) => {
        sentTexts.push(body);
        return { ok: true } as any;
      }
    );

    const session = await db.waSession.findUnique({ where: { phoneE164: "+351900000040" } });
    await handleSongConfirm(session as any, "sim");

    const req = await db.waSongRequest.findFirst({
      where: { contactId: "+351900000040", yogoClassId: 1100 },
    });
    expect(req?.status).toBe("active");
    expect(req?.position).toBe(0);
    const playlist = await db.waClassPlaylist.findUnique({ where: { yogoClassId: 1100 } });
    expect(playlist?.requestCount).toBe(1);
    const after = await db.waSession.findUnique({ where: { phoneE164: "+351900000040" } });
    expect(after?.state).toBe("IDLE");
  });

  it("on 'não' returns session to IDLE without inserting", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000041" } });
    await db.waSession.create({
      data: {
        phoneE164: "+351900000041",
        state: "AWAIT_SONG_CONFIRM",
        pendingSongClassId: 1101,
        pendingTrackId: "boh",
      },
    });
    await db.waClassPlaylist.create({ data: { yogoClassId: 1101, spotifyPlaylistId: "pl1101" } });
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockResolvedValue({ ok: true } as any);

    const session = await db.waSession.findUnique({ where: { phoneE164: "+351900000041" } });
    await handleSongConfirm(session as any, "não");

    const reqs = await db.waSongRequest.findMany();
    expect(reqs).toHaveLength(0);
    const after = await db.waSession.findUnique({ where: { phoneE164: "+351900000041" } });
    expect(after?.state).toBe("IDLE");
  });

  it("triggers swap when active request already exists for class", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000042" } });
    await db.waSession.create({
      data: {
        phoneE164: "+351900000042",
        state: "AWAIT_SONG_CONFIRM",
        pendingSongClassId: 1102,
        pendingTrackId: "newt",
      },
    });
    await db.waClassPlaylist.create({
      data: { yogoClassId: 1102, spotifyPlaylistId: "pl1102", requestCount: 1 },
    });
    await db.waSongRequest.create({
      data: {
        contactId: "+351900000042",
        yogoClassId: 1102,
        spotifyTrackId: "old",
        spotifyTrackName: "OldName",
        spotifyArtistName: "OldA",
        spotifyTrackUri: "spotify:track:old",
        position: 0,
        status: "active",
      },
    });

    const sentTexts: string[] = [];
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockImplementation(
      async (_to: string, body: string) => {
        sentTexts.push(body);
        return { ok: true } as any;
      }
    );

    const session = await db.waSession.findUnique({ where: { phoneE164: "+351900000042" } });
    await handleSongConfirm(session as any, "sim");

    expect(sentTexts.some((t) => t.includes("OldName"))).toBe(true);
    const after = await db.waSession.findUnique({ where: { phoneE164: "+351900000042" } });
    expect(after?.state).toBe("AWAIT_SWAP_CONFIRM");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/lib/wa/song-request.test.ts -t handleSongConfirm`
Expected: FAIL — `handleSongConfirm` not exported.

- [ ] **Step 3: Implement `handleSongConfirm` + `handleSwapConfirm`**

Append to `src/lib/wa/handlers/song-request.ts`:

```typescript
import { insertSongAtNextPosition, swapSong } from "@/lib/spotify/playlist-manager";

export async function handleSongConfirm(session: SessionRow, body: string): Promise<void> {
  const phoneE164 = session.phoneE164;
  const text = body.trim().toLowerCase();

  if (text === "não" || text === "nao" || text === "n" || text === "no") {
    await resetToIdle(session);
    return;
  }
  if (!(text === "sim" || text === "s" || text === "yes" || text === "y")) {
    await sendText(phoneE164, "Responde 'sim' ou 'não'.");
    return;
  }

  if (!session.pendingSongClassId || !session.pendingTrackId) {
    await resetToIdle(session);
    return;
  }
  const yogoClassId = session.pendingSongClassId;
  const trackId = session.pendingTrackId;

  // Re-fetch track metadata (cheap, ensures fresh state)
  const result = await evaluateTrack(trackId);
  if (result.outcome !== "accept") {
    await resetToIdle(session);
    return;
  }

  const existing = await db.waSongRequest.findFirst({
    where: { contactId: phoneE164, yogoClassId, status: "active" },
  });

  if (existing) {
    // Offer swap
    const t = await transition(session, {
      state: "AWAIT_SWAP_CONFIRM",
      pendingSongClassId: yogoClassId,
      pendingTrackId: trackId,
      expiresAt: ttlFromNow(),
    });
    if (!t.ok) return;
    await sendText(
      phoneE164,
      `Já pediste "${existing.spotifyTrackName} — ${existing.spotifyArtistName}" para esta aula.\nQueres trocar pela nova (${result.trackName} — ${result.artistName})? (sim/não)`
    );
    return;
  }

  // Insert
  const ins = await insertSongAtNextPosition({
    yogoClassId,
    trackUri: result.trackUri,
  });
  await db.waSongRequest.create({
    data: {
      contactId: phoneE164,
      yogoClassId,
      spotifyTrackId: result.trackId,
      spotifyTrackName: result.trackName,
      spotifyArtistName: result.artistName,
      spotifyTrackUri: result.trackUri,
      position: ins.position,
      status: "active",
    },
  });

  await sendText(phoneE164, "Adicionado! 🥷");
  await resetToIdle(session);
}

export async function handleSwapConfirm(session: SessionRow, body: string): Promise<void> {
  const phoneE164 = session.phoneE164;
  const text = body.trim().toLowerCase();

  if (text !== "sim" && text !== "s" && text !== "yes" && text !== "y") {
    await sendText(phoneE164, "Pedido cancelado. Música anterior mantida.");
    await resetToIdle(session);
    return;
  }

  if (!session.pendingSongClassId || !session.pendingTrackId) {
    await resetToIdle(session);
    return;
  }
  const yogoClassId = session.pendingSongClassId;
  const trackId = session.pendingTrackId;

  const old = await db.waSongRequest.findFirst({
    where: { contactId: phoneE164, yogoClassId, status: "active" },
  });
  if (!old) {
    await resetToIdle(session);
    return;
  }

  const result = await evaluateTrack(trackId);
  if (result.outcome !== "accept") {
    await resetToIdle(session);
    return;
  }

  await swapSong({
    oldRequestId: old.id,
    newTrackUri: result.trackUri,
    newTrackId: result.trackId,
    newTrackName: result.trackName,
    newArtistName: result.artistName,
    contactId: phoneE164,
  });

  await sendText(phoneE164, "Troca feita! 🥷");
  await resetToIdle(session);
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- tests/lib/wa/song-request.test.ts`
Expected: PASS (all song-request tests).

- [ ] **Step 5: Add dispatch routing for `AWAIT_SWAP_CONFIRM`**

Locate dispatch (from Task 10 step 5), add:

```typescript
import { handleSwapConfirm } from "@/lib/wa/handlers/song-request";

case "AWAIT_SWAP_CONFIRM":
  await handleSwapConfirm(session, messageBody);
  return;
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/wa/handlers/song-request.ts src/app/api/whatsapp/webhook/route.ts \
  src/lib/wa/dispatch.ts tests/lib/wa/song-request.test.ts
git commit -m "feat(wa): handleSongConfirm + handleSwapConfirm with FIFO insert and swap-in-place"
```

---

## Task 12: Cancel-booking hook — auto-remove song

**Files:**
- Modify: `src/lib/wa/handlers/cancelar.ts`
- Modify: `tests/lib/wa/song-request.test.ts`

- [ ] **Step 1: Write failing test for cancel-removes-song**

Append to `tests/lib/wa/song-request.test.ts`:

```typescript
import { removeSongOnCancel } from "@/lib/wa/handlers/song-request";

describe("removeSongOnCancel", () => {
  beforeEach(async () => {
    await db.waSongRequest.deleteMany();
    await db.waClassPlaylist.deleteMany();
    await db.waContact.deleteMany();
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    const { saveRefreshToken } = await import("@/lib/spotify/token-store");
    await saveRefreshToken("rt", "u1", "playlist-modify-public");
  });

  it("removes the user's active song request when they cancel their booking", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000050" } });
    await db.waClassPlaylist.create({
      data: { yogoClassId: 1200, spotifyPlaylistId: "pl1200", requestCount: 1 },
    });
    await db.waSongRequest.create({
      data: {
        contactId: "+351900000050",
        yogoClassId: 1200,
        spotifyTrackId: "t",
        spotifyTrackName: "n",
        spotifyArtistName: "a",
        spotifyTrackUri: "spotify:track:t",
        position: 0,
        status: "active",
      },
    });

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("accounts.spotify.com")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      if (url.endsWith("/playlists/pl1200/tracks") && init?.method === "DELETE") {
        return new Response(JSON.stringify({ snapshot_id: "s" }), { status: 200 });
      }
      return new Response("nope", { status: 500 });
    }) as any;

    await removeSongOnCancel("+351900000050", 1200);

    const req = await db.waSongRequest.findFirst({
      where: { contactId: "+351900000050", yogoClassId: 1200 },
    });
    expect(req?.status).toBe("cancelled_by_unbook");
  });

  it("is a no-op if no active song request exists", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000051" } });
    await db.waClassPlaylist.create({
      data: { yogoClassId: 1201, spotifyPlaylistId: "pl1201" },
    });
    // No request → should not throw, no fetch call
    let fetchCalled = false;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      fetchCalled = true;
      return new Response("x", { status: 500 });
    }) as any;
    await expect(removeSongOnCancel("+351900000051", 1201)).resolves.not.toThrow();
    expect(fetchCalled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/lib/wa/song-request.test.ts -t removeSongOnCancel`
Expected: FAIL — `removeSongOnCancel` not exported.

- [ ] **Step 3: Implement `removeSongOnCancel`**

Append to `src/lib/wa/handlers/song-request.ts`:

```typescript
import { removeSongAndRecompress } from "@/lib/spotify/playlist-manager";

export async function removeSongOnCancel(phoneE164: string, yogoClassId: number): Promise<void> {
  const active = await db.waSongRequest.findFirst({
    where: { contactId: phoneE164, yogoClassId, status: "active" },
  });
  if (!active) return;
  try {
    await removeSongAndRecompress(active.id);
  } catch (err) {
    await db.waEvent.create({
      data: {
        kind: "SONG_REMOVE_FAIL",
        phoneE164,
        payload: JSON.stringify({ requestId: active.id, error: String(err) }),
      },
    });
  }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- tests/lib/wa/song-request.test.ts -t removeSongOnCancel`
Expected: PASS.

- [ ] **Step 5: Hook into `handleCancelar` after cancellation confirmed**

Modify `src/lib/wa/handlers/cancelar.ts`. Find where the Yogo cancellation succeeds (search for the success message that confirms cancellation). After that, add:

```typescript
import { removeSongOnCancel } from "@/lib/wa/handlers/song-request";

// after Yogo cancellation succeeds, BEFORE returning to IDLE:
await removeSongOnCancel(session.phoneE164, classIdJustCancelled);
```

Locate the class id from the cancel handler's local state (likely `session.pendingClassId` or the signup's class id).

- [ ] **Step 6: Commit**

```bash
git add src/lib/wa/handlers/song-request.ts src/lib/wa/handlers/cancelar.ts \
  tests/lib/wa/song-request.test.ts
git commit -m "feat(wa): auto-remove song from playlist on booking cancellation"
```

---

## Task 13: Discovery menu — Outros > Playlist

**Files:**
- Create: `src/lib/wa/handlers/playlist-list.ts`
- Modify: `src/lib/wa/handlers/menu.ts`
- Modify: `src/lib/wa/render.ts` (add new menu rendering)
- Create: `tests/lib/wa/playlist-list.test.ts`

- [ ] **Step 1: Write failing test for `handlePlaylistList`**

Create `tests/lib/wa/playlist-list.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { handlePlaylistList } from "@/lib/wa/handlers/playlist-list";

describe("handlePlaylistList", () => {
  beforeEach(async () => {
    await db.waClassPlaylist.deleteMany();
    await db.waContact.deleteMany();
    vi.restoreAllMocks();
  });

  it("lists reserved group classes for the next 24h with Spotify links", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000060" } });
    await db.waClassPlaylist.create({ data: { yogoClassId: 5001, spotifyPlaylistId: "plA" } });
    await db.waClassPlaylist.create({ data: { yogoClassId: 5002, spotifyPlaylistId: "plB" } });

    const sentTexts: string[] = [];
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockImplementation(
      async (_to: string, body: string) => {
        sentTexts.push(body);
        return { ok: true } as any;
      }
    );

    // Mock the booking listing: assume there's a Yogo helper that returns
    // the user's bookings. Adjust to whatever the actual helper is named.
    vi.spyOn(await import("@/lib/yogo/signups"), "userBookingsNext24h" as any).mockResolvedValue([
      { yogoClassId: 5001, className: "Muay Thai", startsAtIso: "2026-05-27T19:00:00Z" },
      { yogoClassId: 5002, className: "BJJ", startsAtIso: "2026-05-28T10:00:00Z" },
    ] as any);

    await handlePlaylistList("+351900000060");

    expect(sentTexts.length).toBe(1);
    expect(sentTexts[0]).toContain("Muay Thai");
    expect(sentTexts[0]).toContain("https://open.spotify.com/playlist/plA");
    expect(sentTexts[0]).toContain("BJJ");
    expect(sentTexts[0]).toContain("https://open.spotify.com/playlist/plB");
  });

  it("sends a 'no upcoming classes' message when user has none", async () => {
    await db.waContact.create({ data: { phoneE164: "+351900000061" } });
    const sentTexts: string[] = [];
    vi.spyOn(await import("@/lib/wa/meta"), "sendText").mockImplementation(
      async (_to: string, body: string) => {
        sentTexts.push(body);
        return { ok: true } as any;
      }
    );
    vi.spyOn(await import("@/lib/yogo/signups"), "userBookingsNext24h" as any).mockResolvedValue([] as any);

    await handlePlaylistList("+351900000061");
    expect(sentTexts[0]).toMatch(/sem aulas/i);
  });
});
```

Note: `userBookingsNext24h` is a helper that needs to exist in `src/lib/yogo/signups.ts`. If it doesn't, implement it in step 3 as part of this task. It should call the existing Yogo lookup for the user's bookings.

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/lib/wa/playlist-list.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helper `userBookingsNext24h` (if missing)**

Inspect `src/lib/yogo/signups.ts`. If a helper for "user's bookings next 24h" doesn't exist, add:

```typescript
export interface UserBooking {
  yogoClassId: number;
  className: string;
  startsAtIso: string;
}

export async function userBookingsNext24h(phoneE164: string): Promise<UserBooking[]> {
  // Reuse the existing customer lookup
  const customer = await findCustomerByPhone(phoneE164);
  if (!customer) return [];

  // Yogo: GET /class-signups?user_id=...&from=today&to=tomorrow
  // (Endpoint shape: see strikedash_vault/Yogo-API.md or existing code)
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);

  const res = await yogoFetch(
    `/class-signups?user_id=${customer.id}&from=${today}&to=${tomorrow}`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { signups?: any[] };
  const signups = data.signups ?? [];

  return signups
    .filter((s) => (s.class?.max_attendees ?? 0) > 1) // group classes only
    .map((s) => ({
      yogoClassId: s.class.id,
      className: s.class.class_type?.name ?? `Class ${s.class.id}`,
      startsAtIso: s.class.start_time,
    }));
}
```

Adjust import and exact Yogo endpoint to match the existing pattern in the file.

- [ ] **Step 4: Implement `handlePlaylistList`**

Create `src/lib/wa/handlers/playlist-list.ts`:

```typescript
import { db } from "@/lib/db";
import { sendText } from "@/lib/wa/meta";
import { userBookingsNext24h } from "@/lib/yogo/signups";

const NO_CLASSES = "Sem aulas em grupo reservadas nas próximas 24h. Reserva uma com 'reserva' primeiro 🥷";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${dd} ${hh}:${mm}`;
}

export async function handlePlaylistList(phoneE164: string): Promise<void> {
  const bookings = await userBookingsNext24h(phoneE164);
  if (bookings.length === 0) {
    await sendText(phoneE164, NO_CLASSES);
    return;
  }
  const playlists = await db.waClassPlaylist.findMany({
    where: { yogoClassId: { in: bookings.map((b) => b.yogoClassId) } },
  });
  const byClass = new Map(playlists.map((p) => [p.yogoClassId, p.spotifyPlaylistId]));

  const lines = ["As tuas próximas aulas:", ""];
  for (let i = 0; i < bookings.length; i++) {
    const b = bookings[i];
    const plId = byClass.get(b.yogoClassId);
    if (!plId) continue;
    lines.push(`${i + 1}. ${formatTime(b.startsAtIso)} — ${b.className}`);
    lines.push(`   https://open.spotify.com/playlist/${plId}`);
  }
  await sendText(phoneE164, lines.join("\n"));
}
```

- [ ] **Step 5: Run test, verify pass**

Run: `npm test -- tests/lib/wa/playlist-list.test.ts`
Expected: PASS (both tests).

- [ ] **Step 6: Wire into menu — new "Playlist" button in Outros submenu**

Modify `src/lib/wa/handlers/menu.ts`. The current `handleOutros` sends a static message. Replace with an interactive option:

```typescript
import { handlePlaylistList } from "@/lib/wa/handlers/playlist-list";
import { sendButton, sendText } from "@/lib/wa/meta";

const OUTROS_BODY = "Outros: escolhe uma opção.";

export async function handleOutros(phoneE164: string): Promise<void> {
  await sendButton(phoneE164, {
    body: OUTROS_BODY,
    buttons: [
      { id: "btn_playlist", title: "Playlist" },
      { id: "btn_contact", title: "Contacto" },
    ],
  });
}

// Add a routing helper that the dispatch can call when a button reply
// matches one of the IDs above.
export async function handleOutrosButton(phoneE164: string, buttonId: string): Promise<void> {
  if (buttonId === "btn_playlist") {
    await handlePlaylistList(phoneE164);
    return;
  }
  if (buttonId === "btn_contact") {
    await sendText(phoneE164, "Entre em contacto com o número de atendimento.");
    return;
  }
}
```

Update dispatch (in webhook route or dispatch.ts) to route `btn_playlist` and `btn_contact` button replies through `handleOutrosButton`. Look at how `btn_reservar` is currently handled and follow the same pattern.

- [ ] **Step 7: Commit**

```bash
git add src/lib/wa/handlers/playlist-list.ts src/lib/wa/handlers/menu.ts \
  src/lib/yogo/signups.ts tests/lib/wa/playlist-list.test.ts \
  src/app/api/whatsapp/webhook/route.ts src/lib/wa/dispatch.ts
git commit -m "feat(wa): Outros > Playlist lists user's upcoming class Spotify links"
```

---

## Task 14: Admin UI — blocklist CRUD

**Files:**
- Create: `src/app/api/whatsapp/admin/spotify-blocklist/route.ts`
- Create: `src/app/dashboard/wa/blocklist/page.tsx`

- [ ] **Step 1: Create API endpoints**

Create `src/app/api/whatsapp/admin/spotify-blocklist/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  await requireAdminSession(req);
  const genres = await db.waBlockedGenre.findMany({ orderBy: { addedAt: "desc" } });
  const artists = await db.waBlockedArtist.findMany({ orderBy: { addedAt: "desc" } });
  return NextResponse.json({ genres, artists });
}

export async function POST(req: Request) {
  const session = await requireAdminSession(req);
  const body = (await req.json()) as
    | { type: "genre"; keyword: string }
    | { type: "artist"; spotifyArtistId: string; artistName: string; reason?: string };

  if (body.type === "genre") {
    if (!body.keyword || body.keyword.length < 2) {
      return NextResponse.json({ error: "keyword too short" }, { status: 400 });
    }
    const created = await db.waBlockedGenre.upsert({
      where: { keyword: body.keyword.toLowerCase() },
      create: { keyword: body.keyword.toLowerCase(), addedBy: session.role },
      update: { active: true },
    });
    return NextResponse.json({ ok: true, entry: created });
  }
  if (body.type === "artist") {
    if (!body.spotifyArtistId || !body.artistName) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    const created = await db.waBlockedArtist.upsert({
      where: { spotifyArtistId: body.spotifyArtistId },
      create: {
        spotifyArtistId: body.spotifyArtistId,
        artistName: body.artistName,
        reason: body.reason ?? null,
        addedBy: session.role,
      },
      update: { artistName: body.artistName, reason: body.reason ?? null },
    });
    return NextResponse.json({ ok: true, entry: created });
  }
  return NextResponse.json({ error: "invalid type" }, { status: 400 });
}

export async function DELETE(req: Request) {
  await requireAdminSession(req);
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  if (!type || !id) return NextResponse.json({ error: "missing params" }, { status: 400 });

  if (type === "genre") {
    await db.waBlockedGenre.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
  if (type === "artist") {
    await db.waBlockedArtist.delete({ where: { spotifyArtistId: id } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "invalid type" }, { status: 400 });
}
```

If `requireAdminSession` returns a different shape (the existing admin endpoints have a pattern — inspect `src/app/api/whatsapp/admin/reset-session/route.ts`), adapt accordingly.

- [ ] **Step 2: Create admin page**

Create `src/app/dashboard/wa/blocklist/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";

interface BlockedGenre {
  id: string;
  keyword: string;
  addedBy: string;
  addedAt: string;
  active: boolean;
}

interface BlockedArtist {
  spotifyArtistId: string;
  artistName: string;
  reason: string | null;
  addedBy: string;
  addedAt: string;
}

export default function BlocklistPage() {
  const [genres, setGenres] = useState<BlockedGenre[]>([]);
  const [artists, setArtists] = useState<BlockedArtist[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newArtistId, setNewArtistId] = useState("");
  const [newArtistName, setNewArtistName] = useState("");
  const [newReason, setNewReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/whatsapp/admin/spotify-blocklist");
    const data = await res.json();
    setGenres(data.genres);
    setArtists(data.artists);
  }

  useEffect(() => {
    load();
  }, []);

  async function addGenre() {
    if (!newKeyword.trim()) return;
    setLoading(true);
    await fetch("/api/whatsapp/admin/spotify-blocklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "genre", keyword: newKeyword.trim() }),
    });
    setNewKeyword("");
    await load();
    setLoading(false);
  }

  async function addArtist() {
    if (!newArtistId.trim() || !newArtistName.trim()) return;
    setLoading(true);
    await fetch("/api/whatsapp/admin/spotify-blocklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "artist",
        spotifyArtistId: newArtistId.trim(),
        artistName: newArtistName.trim(),
        reason: newReason.trim() || undefined,
      }),
    });
    setNewArtistId("");
    setNewArtistName("");
    setNewReason("");
    await load();
    setLoading(false);
  }

  async function remove(type: "genre" | "artist", id: string) {
    setLoading(true);
    await fetch(`/api/whatsapp/admin/spotify-blocklist?type=${type}&id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await load();
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Spotify Blocklist</h1>

      <section>
        <h2 className="text-lg mb-3 text-zinc-300">Géneros bloqueados ({genres.length})</h2>
        <div className="flex gap-2 mb-4">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="ex: funk carioca"
            className="flex-1 bg-zinc-900 border border-zinc-800 px-3 py-2 rounded text-sm"
          />
          <button
            onClick={addGenre}
            disabled={loading}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-4 py-2 rounded text-sm"
          >
            Adicionar
          </button>
        </div>
        <ul className="space-y-1">
          {genres.map((g) => (
            <li
              key={g.id}
              className="flex justify-between items-center bg-zinc-900 border border-zinc-800 px-3 py-2 rounded text-sm"
            >
              <span>
                <span className="font-mono">{g.keyword}</span>
                {!g.active && <span className="ml-2 text-zinc-500">(inactive)</span>}
              </span>
              <button
                onClick={() => remove("genre", g.id)}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg mb-3 text-zinc-300">Artistas bloqueados ({artists.length})</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <input
            value={newArtistId}
            onChange={(e) => setNewArtistId(e.target.value)}
            placeholder="Spotify artist ID"
            className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded text-sm"
          />
          <input
            value={newArtistName}
            onChange={(e) => setNewArtistName(e.target.value)}
            placeholder="Nome do artista"
            className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded text-sm"
          />
          <div className="flex gap-2">
            <input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Razão (opcional)"
              className="flex-1 bg-zinc-900 border border-zinc-800 px-3 py-2 rounded text-sm"
            />
            <button
              onClick={addArtist}
              disabled={loading}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-3 py-2 rounded text-sm"
            >
              +
            </button>
          </div>
        </div>
        <ul className="space-y-1">
          {artists.map((a) => (
            <li
              key={a.spotifyArtistId}
              className="flex justify-between items-center bg-zinc-900 border border-zinc-800 px-3 py-2 rounded text-sm"
            >
              <span>
                <span>{a.artistName}</span>
                <span className="ml-2 text-zinc-500 font-mono text-xs">{a.spotifyArtistId}</span>
                {a.reason && <span className="ml-2 text-zinc-400">— {a.reason}</span>}
              </span>
              <button
                onClick={() => remove("artist", a.spotifyArtistId)}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Add nav entry to dashboard**

Find the admin nav configuration (existing entries for `/dashboard/wa`, `/dashboard/wa/coverage`, etc.) and add `/dashboard/wa/blocklist` labelled "Blocklist". Inspect `src/components/Nav.tsx` or the equivalent.

- [ ] **Step 4: Manual smoke test**

1. Login as admin, visit `/dashboard/wa/blocklist`.
2. Add a test genre keyword "test-genre", verify it appears in the list.
3. Remove it, verify removed.
4. Add a test artist (ID `4Z8W4fKeB5YxbusRsdQVPb` = Radiohead, just for test).
5. Remove the test artist.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/whatsapp/admin/spotify-blocklist \
  src/app/dashboard/wa/blocklist \
  src/components/Nav.tsx
git commit -m "feat(spotify): admin UI for managing genre + artist blocklist"
```

---

## Task 15: Window lock — cron to lock playlists 10 min after start

**Files:**
- Create: `src/app/api/cron/spotify-playlist-lock/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create cron handler**

Create `src/app/api/cron/spotify-playlist-lock/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listClasses } from "@/lib/yogo/signups";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return new NextResponse("unauthorized", { status: 401 });

  const today = isoDate(0);
  const tomorrow = isoDate(1);
  const all = (await listClasses(today, tomorrow)) as any[];
  const now = Date.now();
  const cutoff = 10 * 60 * 1000;

  let locked = 0;
  for (const k of all) {
    const start = new Date(k.start_time).getTime();
    if (now - start >= cutoff) {
      const r = await db.waClassPlaylist.updateMany({
        where: { yogoClassId: k.id, locked: false },
        data: { locked: true },
      });
      locked += r.count;
    }
  }
  return NextResponse.json({ ok: true, locked });
}
```

- [ ] **Step 2: Register cron in `vercel.json`**

Add to `crons`:

```json
{ "path": "/api/cron/spotify-playlist-lock", "schedule": "*/5 * * * *" }
```

Resulting file:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/trial-followup", "schedule": "0 10 * * *" },
    { "path": "/api/cron/trial-followup", "schedule": "0 11 * * *" },
    { "path": "/api/cron/wa-purge", "schedule": "0 3 * * *" },
    { "path": "/api/cron/spotify-playlists", "schedule": "0 4 * * *" },
    { "path": "/api/cron/spotify-playlist-lock", "schedule": "*/5 * * * *" }
  ]
}
```

Note: every-5-minutes cron is heavy. If the project's Vercel plan limits cron frequency, increase to every 10 min and accept that the actual lock cutoff drifts to 10-20 min. Document the choice in the spec.

- [ ] **Step 3: Manual smoke test**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/spotify-playlist-lock
```
Expected: `{ ok: true, locked: N }` where N is number of just-locked playlists.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/spotify-playlist-lock vercel.json
git commit -m "feat(spotify): cron locks class playlist 10 min after class start"
```

---

## Self-Review

Performed per the writing-plans skill checklist:

**1. Spec coverage:**

| Spec section | Task(s) |
|---|---|
| Daily cron (madrugada, 20 shuffled tracks) | Task 4 |
| Fluxo de pedido (pós-reserva → offer → input → confirm) | Tasks 9, 10, 11 |
| Fluxo "Outros > Playlist" | Task 13 |
| Pedido repetido (swap) | Task 11 |
| Cancelamento de reserva | Task 12 |
| Janela temporal (10min após início) | Tasks 10 (rejected_window path), 15 (lock cron) |
| Censura síncrona | Tasks 7, 10 |
| Blocklist tables + seed | Task 7 |
| Auto-blacklist crescente (admin) | Task 14 |
| Modelo de dados (Prisma) | Tasks 1, 4, 6, 7 |
| OAuth Spotify | Tasks 2, 3 |
| Endpoints Spotify usados | Distributed across tasks |
| Tratamento de erros | Implemented inline in each handler |
| Estratégia de testes | TDD steps in each task |

All sections covered.

**2. Placeholder scan:** No "TBD", "TODO", "implement later" markers. Code blocks are complete.

**3. Type consistency:** `WaSongRequest` fields used identically across Tasks 5, 6, 9, 10, 11, 12. `WaClassPlaylist.requestCount` increment/decrement consistent. `spotifyTrackUri` field used everywhere needed.

**4. Cross-task ordering note added:** Task 5 (insert/remove/swap impls) depends on Task 6 (WaSongRequest model). The plan flags this — either run Task 6 first, or write Task 5's signatures and run Task 6 before running Task 5's tests.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-27-spotify-playlist-per-class.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
