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
            href="/api/spotify/login"
            className="inline-block bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded text-sm"
          >
            Re-authenticate
          </a>
        </div>
      ) : (
        <a
          href="/api/spotify/login"
          className="inline-block bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded"
        >
          Connect Spotify
        </a>
      )}
    </div>
  );
}
