import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveRefreshToken } from "@/lib/spotify/token-store";

const TOKEN_URL = "https://accounts.spotify.com/api/token";

export async function GET(req: Request) {
  const role = await getSession();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

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
