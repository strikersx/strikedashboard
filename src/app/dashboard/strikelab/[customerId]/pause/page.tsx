"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type PauseKind = "medical" | "vacation" | "personal";

const PAUSE_LABELS: Record<PauseKind, { label: string; color: string }> = {
  medical: { label: "Médica", color: "text-red-400" },
  vacation: { label: "Férias", color: "text-amber-400" },
  personal: { label: "Pessoal", color: "text-blue-400" },
};

export default function PauseFlagsPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const [kind, setKind] = useState<PauseKind>("medical");
  const [until, setUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSet = async (clear: boolean = false) => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const body: Record<string, unknown> = { customerId: parseInt(customerId, 10) };
      if (clear) {
        body[`${kind}PauseUntil`] = null;
      } else {
        body[`${kind}PauseUntil`] = until;
      }

      const res = await fetch("/api/strikelab/admin/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(clear ? `✓ Pausa ${PAUSE_LABELS[kind].label} removida` : `✓ Pausa ${PAUSE_LABELS[kind].label} definida até ${until}`);
        setUntil("");
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
      <h1 className="text-lg font-bold text-white mt-2">Pausas #{customerId}</h1>

      <div className="mt-4 space-y-3">
        {/* Kind selector */}
        <div className="flex gap-2">
          {(Object.keys(PAUSE_LABELS) as PauseKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 rounded text-sm ${
                kind === k
                  ? `bg-zinc-800 ${PAUSE_LABELS[k].color} font-medium`
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {PAUSE_LABELS[k].label}
            </button>
          ))}
        </div>

        {/* Date input */}
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Até (data)</label>
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => handleSet()}
            disabled={loading || !until}
            className="flex-1 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50"
          >
            Definir pausa
          </button>
          <button
            onClick={() => handleSet(true)}
            disabled={loading}
            className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50"
          >
            Remover
          </button>
        </div>
      </div>

      {result && <p className="text-emerald-400 text-sm mt-3">{result}</p>}
      {error && <p className="text-red-400 text-sm mt-3">✗ {error}</p>}
    </div>
  );
}
