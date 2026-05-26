"use client";

import { useCallback, useEffect, useState } from "react";

interface HealthResponse {
  enabled: boolean;
  generatedAt: string;
  last24h: {
    eventsByKind: Record<string, number>;
    outboundFailed: number;
  };
  sessions: { active: number; expired: number };
}

interface Inbound {
  id: string;
  phoneE164: string;
  body: string;
  receivedAt: string;
}
interface Event {
  id: string;
  kind: string;
  phoneE164: string | null;
  meta: string | null;
  createdAt: string;
}
interface Outbound {
  id: string;
  phoneE164: string;
  kind: string;
  status: string;
  error: string | null;
  sentAt: string;
}
interface SessionRow {
  phoneE164: string;
  state: string;
  pendingClassId: number | null;
  pendingSignupId: number | null;
  expiresAt: string | null;
  version: number;
  updatedAt: string;
}

interface RecentResponse {
  inbounds: Inbound[];
  events: Event[];
  outbounds: Outbound[];
  sessions: SessionRow[];
}

const POLL_MS = 10_000;

export default function WaPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [recent, setRecent] = useState<RecentResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [h, r] = await Promise.all([
        fetch("/api/whatsapp/health").then((res) => (res.ok ? res.json() : Promise.reject(new Error("health " + res.status)))),
        fetch("/api/whatsapp/health/recent").then((res) => (res.ok ? res.json() : Promise.reject(new Error("recent " + res.status)))),
      ]);
      setHealth(h);
      setRecent(r);
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div style={{ padding: "8px 18px 32px" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "12px 0 16px" }}>
        <h1 className="head" style={{ fontSize: 22, color: "#fff" }}>WhatsApp bot</h1>
        {health && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 999,
              background: health.enabled ? "rgba(0,229,160,0.15)" : "rgba(245,158,11,0.18)",
              color: health.enabled ? "#00E5A0" : "#fbbf24",
            }}
          >
            {health.enabled ? "ATIVO" : "PAUSADO"}
          </span>
        )}
      </header>

      {err && (
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.12)", color: "#fca5a5", marginBottom: 16 }}>
          {err}
        </div>
      )}

      {health && (
        <section style={{ marginBottom: 22 }}>
          <SectionTitle>Últimas 24h</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {Object.entries(health.last24h.eventsByKind).length === 0 && (
              <MetricCard label="EVENTOS" value="0" hint="sem actividade" />
            )}
            {Object.entries(health.last24h.eventsByKind).map(([kind, n]) => (
              <MetricCard key={kind} label={kind} value={String(n)} hint={hintFor(kind)} />
            ))}
            <MetricCard
              label="OUTBOUND FAIL"
              value={String(health.last24h.outboundFailed)}
              hint={health.last24h.outboundFailed === 0 ? "ok" : "investigar"}
              accent={health.last24h.outboundFailed > 0 ? "warn" : "ok"}
            />
            <MetricCard
              label="SESSÕES ACTIVAS"
              value={String(health.sessions.active)}
              hint={`${health.sessions.expired} expiradas`}
            />
          </div>
        </section>
      )}

      {recent && (
        <>
          <Section title="Eventos recentes" empty="Sem eventos.">
            {recent.events.map((e) => (
              <Row key={e.id} time={e.createdAt} phone={e.phoneE164} primary={kindBadge(e.kind)} secondary={e.meta ? truncate(e.meta, 120) : undefined} />
            ))}
          </Section>

          <Section title="Inbounds recentes" empty="Sem mensagens.">
            {recent.inbounds.map((i) => (
              <Row key={i.id} time={i.receivedAt} phone={i.phoneE164} primary={<span style={{ color: "#fff" }}>{truncate(i.body, 80)}</span>} />
            ))}
          </Section>

          <Section title="Outbounds recentes" empty="Sem mensagens enviadas (echoes não persistem; só templates).">
            {recent.outbounds.map((o) => (
              <Row
                key={o.id}
                time={o.sentAt}
                phone={o.phoneE164}
                primary={<span style={{ color: "#fff" }}>{o.kind}</span>}
                secondary={`status=${o.status}${o.error ? ` · ${truncate(o.error, 100)}` : ""}`}
              />
            ))}
          </Section>

          <Section title="Sessões activas" empty="Nenhuma sessão activa.">
            {recent.sessions.map((s) => (
              <Row
                key={s.phoneE164}
                time={s.updatedAt}
                phone={s.phoneE164}
                primary={<span style={{ color: "#fff" }}>{s.state}</span>}
                secondary={`v${s.version}${s.pendingClassId ? ` · class=${s.pendingClassId}` : ""}${s.pendingSignupId ? ` · signup=${s.pendingSignupId}` : ""}${s.expiresAt ? ` · expira ${fmtTime(s.expiresAt)}` : ""}`}
              />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="head" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.5)", margin: "0 0 8px" }}>{children}</h3>;
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const rows = Array.isArray(children) ? children : [children];
  return (
    <section style={{ marginBottom: 22 }}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.length === 0 ? <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{empty}</span> : rows}
      </div>
    </section>
  );
}

function MetricCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: "ok" | "warn" }) {
  const color = accent === "warn" ? "#fbbf24" : "#00E5A0";
  return (
    <div style={{ padding: 12, borderRadius: 10, background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 24, fontWeight: 700, color: accent === "warn" && value !== "0" ? color : "#fff" }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Row({ time, phone, primary, secondary }: { time: string; phone: string | null; primary: React.ReactNode; secondary?: string | React.ReactNode }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, background: "#0F0F14", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", minWidth: 0, flex: 1 }}>
          <span className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>{fmtTime(time)}</span>
          {phone && <span className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>{phone}</span>}
          <span style={{ fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{primary}</span>
        </div>
      </div>
      {secondary && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{secondary}</div>}
    </div>
  );
}

function kindBadge(kind: string): React.ReactNode {
  const colors: Record<string, string> = {
    BOOKING_OK: "#00E5A0",
    CANCEL_OK: "#00E5A0",
    TEMPLATE_SENT: "#00E5A0",
    LOOKUP_MISS: "#fbbf24",
    SESSION_RACE: "#fbbf24",
    TEMPLATE_PENDING: "#fbbf24",
    BOOKING_FAIL: "#ef4444",
    CANCEL_FAIL: "#ef4444",
    HMAC_FAIL: "#ef4444",
    SEND_FAIL: "#ef4444",
    DISPATCH_FAIL: "#ef4444",
    TEMPLATE_FAIL: "#ef4444",
    YOGO_401: "#ef4444",
  };
  return <span style={{ color: colors[kind] ?? "#fff", fontWeight: 600 }}>{kind}</span>;
}

function hintFor(kind: string): string | undefined {
  switch (kind) {
    case "BOOKING_OK": return "reservas bem-sucedidas";
    case "CANCEL_OK": return "cancelamentos OK";
    case "LOOKUP_MISS": return "fallback humano";
    case "SESSION_RACE": return "inbound cruzou-se";
    case "HMAC_FAIL": return "verificar app secret";
    case "SEND_FAIL": return "falha a enviar";
    case "DISPATCH_FAIL": return "crash no handler";
    default: return undefined;
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  return d.toLocaleString("pt-PT", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
