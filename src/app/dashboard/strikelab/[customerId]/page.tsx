"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface StudentData {
  identity: {
    customerId: number;
    phoneE164: string | null;
    email: string | null;
    instagramHandle: string | null;
    igVerifiedAt: string | null;
    optInAt: string | null;
    optOutAt: string | null;
    consentTraining: boolean;
    consentUgc: boolean;
    consentRealName: boolean;
    consentBroadcasts: boolean;
    birthYear: number | null;
    erasedAt: string | null;
    medicalPauseUntil: string | null;
    vacationPauseUntil: string | null;
    personalPauseUntil: string | null;
    createdAt: string;
  };
  state: {
    monthlyPoints: number;
    lifetimeXp: number;
    currentTier: string;
    currentStreakDays: number;
    lastClassAt: string | null;
  } | null;
  events: Array<{
    id: string;
    eventId: number;
    eventType: string;
    pointsDelta: number;
    xpDelta: number;
    source: string;
    pointsPeriod: string | null;
    createdAt: string;
  }>;
}

export default function StudentDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/strikelab/admin/${customerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return <p className="text-zinc-500 text-sm text-center py-8">A carregar...</p>;
  if (!data) return <p className="text-red-400 text-sm text-center py-8">Aluno não encontrado.</p>;

  const { identity, state, events } = data;

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-PT") : "—";
  const fmtDt = (d: string | null) => d ? new Date(d).toLocaleString("pt-PT") : "—";

  return (
    <div>
      {/* Back */}
      <Link href="/dashboard/strikelab" className="text-zinc-500 text-sm hover:text-zinc-300">← Alunos</Link>

      <h1 className="text-lg font-bold text-white mt-2">#{identity.customerId}</h1>
      {identity.erasedAt && (
        <p className="text-red-400 text-xs mt-1">Apagado em {fmt(identity.erasedAt)}</p>
      )}

      {/* State card */}
      {state && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Pontos (mês)" value={String(state.monthlyPoints)} color="text-emerald-400" />
            <Stat label="XP (total)" value={String(state.lifetimeXp)} color="text-blue-400" />
            <Stat label="Nível" value={state.currentTier} color="text-amber-400" />
            <Stat label="Streak" value={`${state.currentStreakDays}d`} color="text-cyan-400" />
          </div>
        </div>
      )}

      {/* Identity card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mt-3">
        <h2 className="text-sm font-medium text-zinc-400 mb-2">Identidade</h2>
        <div className="space-y-1 text-sm">
          <Row label="Telefone" value={identity.phoneE164 ?? "—"} />
          <Row label="Email" value={identity.email ?? "—"} />
          <Row label="Instagram" value={identity.instagramHandle ?? "—"} />
          <Row label="Ano nasc." value={identity.birthYear ? String(identity.birthYear) : "—"} />
          <Row label="Inscrito" value={fmt(identity.optInAt)} />
          <Row label="Desinscrito" value={fmt(identity.optOutAt)} />
        </div>
      </div>

      {/* Consent toggles */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mt-3">
        <h2 className="text-sm font-medium text-zinc-400 mb-2">Consentimentos</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Consent label="Treino" on={identity.consentTraining} />
          <Consent label="UGC" on={identity.consentUgc} />
          <Consent label="Nome real" on={identity.consentRealName} />
          <Consent label="Broadcasts" on={identity.consentBroadcasts} />
        </div>
      </div>

      {/* Pause flags */}
      {(identity.medicalPauseUntil || identity.vacationPauseUntil || identity.personalPauseUntil) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mt-3">
          <h2 className="text-sm font-medium text-amber-400 mb-2">Pausas activas</h2>
          <div className="space-y-1 text-sm">
            {identity.medicalPauseUntil && <Row label="Médica" value={fmt(identity.medicalPauseUntil)} />}
            {identity.vacationPauseUntil && <Row label="Férias" value={fmt(identity.vacationPauseUntil)} />}
            {identity.personalPauseUntil && <Row label="Pessoal" value={fmt(identity.personalPauseUntil)} />}
          </div>
        </div>
      )}

      {/* Events */}
      <div className="mt-4">
        <h2 className="text-sm font-medium text-zinc-400 mb-2">Últimos eventos ({events.length})</h2>
        <div className="space-y-1">
          {events.map((e) => (
            <div key={e.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded px-3 py-2 flex items-center justify-between">
              <div>
                <span className="text-xs text-white font-mono">{e.eventType}</span>
                <span className="text-xs text-zinc-600 ml-2">{e.source}</span>
              </div>
              <div className="flex items-center gap-3">
                {e.pointsDelta !== 0 && (
                  <span className={e.pointsDelta > 0 ? "text-emerald-400 text-xs" : "text-red-400 text-xs"}>
                    {e.pointsDelta > 0 ? "+" : ""}{e.pointsDelta}
                  </span>
                )}
                <span className="text-xs text-zinc-600">{fmtDt(e.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {!identity.erasedAt && (
        <div className="flex gap-2 mt-4">
          <Link
            href={`/dashboard/strikelab/${customerId}/adjust`}
            className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded text-sm hover:bg-emerald-500/30"
          >
            Ajustar pontos
          </Link>
          <Link
            href={`/dashboard/strikelab/${customerId}/pause`}
            className="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded text-sm hover:bg-amber-500/30"
          >
            Pausas
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function Consent({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={on ? "text-emerald-400" : "text-zinc-600"}>
      {on ? "✓" : "✗"} {label}
    </span>
  );
}
