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
