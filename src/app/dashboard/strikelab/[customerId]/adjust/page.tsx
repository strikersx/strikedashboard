"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function AdjustPointsPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/strikelab/admin/adjust-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: parseInt(customerId, 10),
          pointsDelta: parseInt(points, 10),
          reason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`✓ Ajuste registado (${parseInt(points, 10) > 0 ? "+" : ""}${points} pts)`);
        setPoints("");
        setReason("");
      } else {
        setError(data.error || "Erro desconhecido");
      }
    } catch {
      setError("Falha na comunicação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Link href={`/dashboard/strikelab/${customerId}`} className="text-zinc-500 text-sm hover:text-zinc-300">
        ← #{customerId}
      </Link>
      <h1 className="text-lg font-bold text-white mt-2">Ajustar Pontos #{customerId}</h1>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Pontos (+ ou -)</label>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            required
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            placeholder="Ex: 50 ou -20"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Motivo</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            placeholder="Ex: Correcção erro de contagem"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !points || !reason}
          className="w-full py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {loading ? "..." : "Aplicar ajuste"}
        </button>
      </form>

      {result && <p className="text-emerald-400 text-sm mt-3">{result}</p>}
      {error && <p className="text-red-400 text-sm mt-3">✗ {error}</p>}
    </div>
  );
}
