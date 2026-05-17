"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { LoaderIcon } from "@/components/icons";
import { getPlan } from "@/lib/utils";

interface Membership {
  id: number;
  user_id?: number;
  user_full_name?: string;
  user_phone?: string;
  user_email?: string;
  membership_type_name?: string;
  paid_until?: string;
  status?: string;
  status_text?: string;
  ended_because?: string | null;
  next_payment?: { date?: string | null; amount?: number } | null;
}

type Bucket = "paused" | "ending" | "ended";

interface Row {
  m: Membership;
  bucket: Bucket;
}

function classify(m: Membership): Bucket | null {
  if (/^Paus/i.test(m.status_text ?? "")) return "paused";
  if (m.status === "cancelled_running") return "ending";
  if (m.status === "ended" && m.ended_because === "cancelled") return "ended";
  return null;
}

function daysFromToday(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function MembershipRow({ m, bucket }: Row) {
  const name = m.user_full_name || "—";
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const plan = getPlan(m.membership_type_name);
  const days = daysFromToday(m.paid_until);
  const phone = m.user_phone?.trim();

  const accent = bucket === "paused" ? "#C7CCD6" : bucket === "ending" ? "#FFB627" : "rgba(255,255,255,0.4)";

  return (
    <div
      style={{
        background: "#0F0F14",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: "11px 12px",
        display: "flex",
        alignItems: "center",
        gap: 11,
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, #1f1f28 0%, #15151c 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "grid", placeItems: "center", flexShrink: 0,
          fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.02em",
        }}
      >
        {initials || "?"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 2, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plan}</span>
          {phone && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <a href={`tel:${phone}`} style={{ color: "#A6E22E", fontWeight: 600 }}>{phone}</a>
            </>
          )}
        </div>
        {m.status_text && (
          <div style={{ fontSize: 10, color: accent, marginTop: 3, fontStyle: "italic" }}>
            {m.status_text}
          </div>
        )}
      </div>
      {days != null && bucket !== "ended" && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{m.paid_until}</div>
          <div style={{ fontSize: 10.5, color: accent, fontWeight: 700, marginTop: 2 }}>
            {days >= 0 ? `${days}d` : `há ${Math.abs(days)}d`}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PausasPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const memberships = await fetchReport("reports/memberships-list", {}) as unknown as Membership[];
      const classified: Row[] = [];
      for (const m of memberships) {
        const bucket = classify(m);
        if (bucket) classified.push({ m, bucket });
      }
      setRows(classified);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [fetchReport, setLastFetch]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-tone-coral text-sm">Erro: {error}</div>;

  const paused = rows.filter((r) => r.bucket === "paused")
    .sort((a, b) => (a.m.paid_until ?? "").localeCompare(b.m.paid_until ?? ""));
  const ending = rows.filter((r) => r.bucket === "ending")
    .sort((a, b) => (a.m.paid_until ?? "").localeCompare(b.m.paid_until ?? ""));
  const ended = rows.filter((r) => r.bucket === "ended")
    .sort((a, b) => (b.m.paid_until ?? "").localeCompare(a.m.paid_until ?? ""));

  return (
    <div style={{ paddingBottom: 32 }}>
      <div style={{ padding: "4px 18px 14px" }}>
        <h1 className="head" style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>
          Pausas e Cancelamentos
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          Subscrições pausadas e canceladas pelo cliente
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ padding: "0 18px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14 }}>
          <div className="head" style={{ fontSize: 10, color: "rgba(255,255,255,0.72)", marginBottom: 6 }}>PAUSADAS</div>
          <div className="num" style={{ fontSize: 38, color: "#C7CCD6" }}>{paused.length}</div>
        </div>
        <div style={{ background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14 }}>
          <div className="head" style={{ fontSize: 10, color: "rgba(255,255,255,0.72)", marginBottom: 6 }}>A TERMINAR</div>
          <div className="num" style={{ fontSize: 38, color: "#FFB627" }}>{ending.length}</div>
        </div>
      </div>

      {/* Pausadas */}
      {paused.length > 0 && (
        <div>
          <div style={{ padding: "10px 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>Pausadas</h3>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{paused.length}</span>
          </div>
          <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            {paused.map((r) => <MembershipRow key={r.m.id} {...r} />)}
          </div>
        </div>
      )}

      {/* Cancelled, still running */}
      {ending.length > 0 && (
        <div>
          <div style={{ padding: "10px 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>Canceladas pelo cliente · a terminar</h3>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{ending.length}</span>
          </div>
          <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            {ending.map((r) => <MembershipRow key={r.m.id} {...r} />)}
          </div>
        </div>
      )}

      {/* Cancelled, already ended */}
      {ended.length > 0 && (
        <div>
          <div style={{ padding: "10px 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>Canceladas · histórico</h3>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{ended.length}</span>
          </div>
          <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            {ended.map((r) => <MembershipRow key={r.m.id} {...r} />)}
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <div style={{ padding: "20px 18px", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
          Nenhuma subscrição pausada ou cancelada.
        </div>
      )}
    </div>
  );
}
