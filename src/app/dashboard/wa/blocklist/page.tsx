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
    const data = (await res.json()) as { genres: BlockedGenre[]; artists: BlockedArtist[] };
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
