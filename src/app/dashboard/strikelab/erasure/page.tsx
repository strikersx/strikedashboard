"use client";

import { useState } from "react";

export default function ErasurePage() {
  const [customerId, setCustomerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ track: string; eventsAnonymised: number } | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/strikelab/erasure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: parseInt(customerId, 10), track: "A" }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ track: "A", eventsAnonymised: data.eventsAnonymised });
        setCustomerId("");
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
      <h1 className="text-lg font-bold text-white mb-4">Apagamentos (GDPR)</h1>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <p className="text-zinc-400 text-sm mb-3">
          Track A — Pseudonimização. Dados pessoais removidos, customer_id retido para estatísticas.
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Customer ID"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !customerId}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded text-sm font-medium hover:bg-red-500/30 disabled:opacity-50"
          >
            {loading ? "..." : "Apagar (Track A)"}
          </button>
        </div>
        {result && (
          <p className="text-emerald-400 text-sm mt-2">
            ✓ {result.eventsAnonymised} eventos anonimizados.
          </p>
        )}
        {error && <p className="text-red-400 text-sm mt-2">✗ {error}</p>}
      </div>
    </div>
  );
}
