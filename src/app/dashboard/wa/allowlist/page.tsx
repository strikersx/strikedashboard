"use client";

import { useState, useEffect } from "react";

interface AllowedArtist {
  spotifyArtistId: string;
  artistName: string;
  reason: string | null;
  addedBy: string;
  addedAt: string;
}

export default function AllowlistPage() {
  const [artists, setArtists] = useState<AllowedArtist[]>([]);
  const [newArtistId, setNewArtistId] = useState("");
  const [newArtistName, setNewArtistName] = useState("");
  const [newReason, setNewReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/whatsapp/admin/spotify-allowlist");
    const data = (await res.json()) as { artists: AllowedArtist[] };
    setArtists(data.artists);
  }

  useEffect(() => {
    load();
  }, []);

  async function addArtist() {
    if (!newArtistId.trim() || !newArtistName.trim()) return;
    setLoading(true);
    await fetch("/api/whatsapp/admin/spotify-allowlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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

  async function remove(id: string) {
    setLoading(true);
    await fetch(`/api/whatsapp/admin/spotify-allowlist?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await load();
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Spotify Allowlist</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Artistas que escapam ao filtro de keywords (ex: <span className="font-mono">Poesia Acústica</span> que
          seria apanhado por <span className="font-mono">acústico</span>). O blocklist de artistas
          continua a aplicar-se.
        </p>
      </div>

      <section>
        <h2 className="text-lg mb-3 text-zinc-300">Artistas permitidos ({artists.length})</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          <input
            value={newArtistId}
            onChange={(e) => setNewArtistId(e.target.value)}
            placeholder="Spotify artist ID"
            className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded text-sm font-mono"
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
              placeholder="Razão (ex: falso positivo)"
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
        {artists.length === 0 ? (
          <p className="text-zinc-500 text-sm italic">Nenhum artista permitido. Adiciona um Spotify artist ID em cima.</p>
        ) : (
          <ul className="space-y-1">
            {artists.map((a) => (
              <li
                key={a.spotifyArtistId}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-zinc-900 border border-zinc-800 px-3 py-2 rounded text-sm gap-1"
              >
                <span className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                  <span className="font-medium">{a.artistName}</span>
                  <span className="text-zinc-500 font-mono text-xs">{a.spotifyArtistId}</span>
                  {a.reason && <span className="text-zinc-400">— {a.reason}</span>}
                </span>
                <button
                  onClick={() => remove(a.spotifyArtistId)}
                  className="text-red-400 hover:text-red-300 text-xs self-end sm:self-auto"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
