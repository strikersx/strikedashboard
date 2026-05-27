"use client";

import { useCallback, useEffect, useState } from "react";

interface Member {
  phoneE164: string;
  savedName: string | null;
  publicName: string | null;
  labels: string | null;
  isBusiness: boolean;
}

interface Sub {
  customerId: number;
  displayName: string;
  phoneE164: string | null;
  phoneRaw: string | null;
  plan: string | null;
}

interface ExClient {
  customerId: number;
  displayName: string;
  phoneE164: string | null;
  phoneRaw: string | null;
  lastPlan: string | null;
  lastStatus: string | null;
  paidUntil: string | null;
  member: Member;
}

interface LastInvite {
  sentAt: string;
  status: string;
  error: string | null;
}

interface MissingSub extends Sub {
  lastInvite: LastInvite | null;
}

interface Report {
  generatedAt: string;
  totals: {
    subsActive: number;
    inGroup: number;
    covered: number;
    coveredInactive: number;
    missingFromGroup: number;
    unknownInGroup: number;
    subsWithoutPhone: number;
  };
  covered: Array<Sub & { member: Member }>;
  coveredInactive: ExClient[];
  missingFromGroup: MissingSub[];
  unknownInGroup: Member[];
  subsWithoutPhone: Sub[];
}

interface ImportResult {
  ok: boolean;
  inserted: number;
  updated: number;
  deleted: number;
  total: number;
  skipped: { line: number; reason: string; raw: string }[];
}

export default function CoveragePage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [csv, setCsv] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [showImporter, setShowImporter] = useState(false);

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    total: number; sent: number; skipped: number; failed: number; dry: number;
    aborted?: boolean;
    details: Array<{ phoneE164: string; outcome: string; reason?: string; metaError?: string }>;
  } | null>(null);
  const [bulkErr, setBulkErr] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{
    outcome: string; reason?: string; metaError?: string;
  } | null>(null);

  const resync = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/whatsapp/admin/group-coverage", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Report;
      setReport(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void resync(); }, [resync]);

  const runImport = useCallback(async () => {
    if (!csv.trim() || importBusy) return;
    setImportBusy(true);
    setImportErr(null);
    setImportResult(null);
    try {
      const res = await fetch("/api/whatsapp/admin/group-members/import", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: csv,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setImportResult(data as ImportResult);
      setCsv("");
      await resync();
    } catch (e: unknown) {
      setImportErr(e instanceof Error ? e.message : String(e));
    } finally {
      setImportBusy(false);
    }
  }, [csv, importBusy, resync]);

  const runBulk = useCallback(async () => {
    if (!report || bulkBusy) return;
    const phones = report.missingFromGroup.map((m) => m.phoneE164).filter((p): p is string => !!p);
    if (phones.length === 0) return;

    const confirmed = window.confirm(
      `Enviar template a ${phones.length} pessoas? Quem foi convidado nos últimos 30d será saltado.\n\nOK para enviar. Cancelar para abortar.`,
    );
    if (!confirmed) return;

    setBulkBusy(true);
    setBulkErr(null);
    setBulkResult(null);
    try {
      const res = await fetch("/api/whatsapp/admin/group-invite/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneE164s: phones, force: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setBulkResult(data);
      await resync();
    } catch (e: unknown) {
      setBulkErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  }, [report, bulkBusy, resync]);

  const runTest = useCallback(async () => {
    if (testBusy || !testPhone.trim()) return;
    setTestBusy(true);
    setTestResult(null);
    setBulkErr(null);
    try {
      const res = await fetch("/api/whatsapp/admin/group-invite/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneE164s: [testPhone.trim()], force: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ outcome: "failed", reason: data.error || `HTTP ${res.status}` });
        return;
      }
      const detail = data.details?.[0];
      setTestResult({
        outcome: detail?.outcome ?? "unknown",
        reason: detail?.reason,
        metaError: detail?.metaError,
      });
      await resync();
    } catch (e: unknown) {
      setTestResult({ outcome: "failed", reason: e instanceof Error ? e.message : String(e) });
    } finally {
      setTestBusy(false);
    }
  }, [testBusy, testPhone, resync]);

  return (
    <div style={{ padding: "8px 18px 32px" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "12px 0 16px", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="head" style={{ fontSize: 22, color: "#fff", margin: 0 }}>Cobertura WhatsApp</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            Subscritores activos recorrentes × membros do grupo
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowImporter((v) => !v)} style={btnStyle("ghost")}>
            {showImporter ? "Esconder importação" : "Importar lista"}
          </button>
          <button onClick={resync} disabled={loading} style={btnStyle("primary", loading)}>
            {loading ? "A sincronizar..." : "Resync"}
          </button>
        </div>
      </header>

      {err && (
        <div style={errBox}>{err}</div>
      )}

      {showImporter && (
        <section style={{ marginBottom: 22, padding: 12, borderRadius: 10, background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)" }}>
          <SectionTitle>Importar lista do grupo</SectionTitle>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 8px" }}>
            Cola o export do WhatsApp (TSV ou CSV com cabeçalho <code>Country Code, ..., Formatted Phone, ...</code>). A lista substitui o roster actual.
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="Country Code\tCountry Name\tPhone Number\tFormatted Phone\t..."
            style={{
              width: "100%",
              minHeight: 140,
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              padding: 10,
              borderRadius: 6,
              background: "#000",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <button onClick={runImport} disabled={importBusy || !csv.trim()} style={btnStyle("primary", importBusy || !csv.trim())}>
              {importBusy ? "A importar..." : "Importar"}
            </button>
            {importErr && <span style={{ fontSize: 12, color: "#fca5a5" }}>{importErr}</span>}
            {importResult && (
              <span style={{ fontSize: 12, color: "#00E5A0" }}>
                ✓ {importResult.total} linhas (+{importResult.inserted} novos · {importResult.updated} actualizados · {importResult.deleted} removidos · {importResult.skipped.length} ignorados)
              </span>
            )}
          </div>
          {importResult && importResult.skipped.length > 0 && (
            <details style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
              <summary style={{ cursor: "pointer" }}>Linhas ignoradas ({importResult.skipped.length})</summary>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {importResult.skipped.map((s) => (
                  <li key={s.line}>linha {s.line}: {s.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {report && (
        <>
          <section style={{ marginBottom: 22 }}>
            <SectionTitle>Resumo</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
              <Metric label="SUBS ACTIVOS" value={report.totals.subsActive} hint="recorrentes" />
              <Metric label="NO GRUPO" value={report.totals.inGroup} hint="roster importado" />
              <Metric label="COBERTOS" value={report.totals.covered} hint="sub activa ∩ grupo" accent="ok" />
              <Metric label="EX-CLIENTES" value={report.totals.coveredInactive} hint="no Yogo + grupo, sub inactiva" />
              <Metric label="FALTAM CONVIDAR" value={report.totals.missingFromGroup} hint="sub mas fora do grupo" accent={report.totals.missingFromGroup > 0 ? "warn" : "ok"} />
              <Metric label="DESCONHECIDOS" value={report.totals.unknownInGroup} hint="no grupo, nem no Yogo" accent={report.totals.unknownInGroup > 0 ? "warn" : "ok"} />
              <Metric label="SEM TELEMÓVEL" value={report.totals.subsWithoutPhone} hint="Yogo não tem nº" accent={report.totals.subsWithoutPhone > 0 ? "warn" : "ok"} />
            </div>
          </section>

          <section style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <h3 className="head" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: report.missingFromGroup.length > 0 ? "#fbbf24" : "#fff", margin: 0 }}>
                Faltam convidar ({report.missingFromGroup.length})
              </h3>
              {report.missingFromGroup.length > 0 && (
                <button onClick={runBulk} disabled={bulkBusy} style={btnStyle("primary", bulkBusy)}>
                  {bulkBusy ? "A enviar..." : "Convidar todos"}
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>🧪 Testar:</span>
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+351912873698"
                style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, background: "#000", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", width: 200, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              />
              <button onClick={runTest} disabled={testBusy || !testPhone.trim()} style={btnStyle("ghost")}>
                {testBusy ? "..." : "Enviar teste"}
              </button>
              {testResult && (
                <span style={{ fontSize: 12, color: testResult.outcome === "sent" ? "#00E5A0" : testResult.outcome === "skipped" ? "#fbbf24" : "#fca5a5" }}>
                  {testResult.outcome}{testResult.reason ? ` · ${testResult.reason}` : ""}{testResult.metaError ? ` · ${testResult.metaError}` : ""}
                </span>
              )}
            </div>

            {bulkResult && (
              <div style={{ padding: 10, borderRadius: 8, background: "rgba(0,229,160,0.08)", color: "#bbf7d0", fontSize: 12, marginBottom: 10 }}>
                ✓ {bulkResult.sent} enviados · {bulkResult.skipped} saltados · {bulkResult.failed} falharam
              </div>
            )}
            {bulkResult?.aborted && (
              <div style={errBox}>
                Envio interrompido — credenciais Meta inválidas. Contactar ops.
              </div>
            )}
            {bulkErr && (
              <div style={errBox}>{bulkErr}</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {report.missingFromGroup.length === 0 ? (
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Todos os subscritores activos já estão no grupo 🎉</span>
              ) : (
                report.missingFromGroup.map((s) => (
                  <MissingSubRow key={s.customerId} sub={s} />
                ))
              )}
            </div>
          </section>

          <Section title={`Desconhecidos no grupo (${report.unknownInGroup.length})`} empty="Todos no grupo estão no Yogo." accent="warn">
            {report.unknownInGroup.map((m) => (
              <MemberRow key={m.phoneE164} member={m} />
            ))}
          </Section>

          <Section title={`Ex-clientes no grupo (${report.coveredInactive.length})`} empty="Sem ex-clientes no grupo." muted collapsed>
            {report.coveredInactive.map((c) => (
              <ExClientRow key={c.customerId} ex={c} />
            ))}
          </Section>

          <Section title={`Cobertos (${report.covered.length})`} empty="Sem subscritores cobertos." muted collapsed>
            {report.covered.map((s) => (
              <SubRow key={s.customerId} sub={s} member={s.member} />
            ))}
          </Section>

          {report.subsWithoutPhone.length > 0 && (
            <Section title={`Subscritores sem telemóvel (${report.subsWithoutPhone.length})`} empty="" accent="warn">
              {report.subsWithoutPhone.map((s) => (
                <SubRow key={s.customerId} sub={s} />
              ))}
            </Section>
          )}

          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 16 }}>
            Gerado a {new Date(report.generatedAt).toLocaleString("pt-PT")}
          </p>
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="head" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.5)", margin: "0 0 8px" }}>{children}</h3>;
}

function Section({ title, empty, children, accent, muted, collapsed }: { title: string; empty: string; children: React.ReactNode; accent?: "warn"; muted?: boolean; collapsed?: boolean }) {
  const rows = Array.isArray(children) ? children : [children];
  const [open, setOpen] = useState(!collapsed);
  const color = accent === "warn" ? "#fbbf24" : muted ? "rgba(255,255,255,0.5)" : "#fff";
  return (
    <section style={{ marginBottom: 22 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ all: "unset", cursor: "pointer", display: "block", marginBottom: 8 }}>
        <h3 className="head" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color, margin: 0 }}>
          {open ? "▾" : "▸"} {title}
        </h3>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.length === 0 || (rows.length === 1 && !rows[0]) ? <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{empty}</span> : rows}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, hint, accent }: { label: string; value: number; hint?: string; accent?: "ok" | "warn" }) {
  const color = accent === "warn" ? "#fbbf24" : accent === "ok" ? "#00E5A0" : "#fff";
  const display = accent && value > 0 ? color : "#fff";
  return (
    <div style={{ padding: 12, borderRadius: 10, background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 24, fontWeight: 700, color: display }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function MissingSubRow({ sub }: { sub: MissingSub }) {
  return (
    <div style={rowStyle}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", minWidth: 0, flex: 1, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{sub.displayName}</span>
        {sub.plan && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{sub.plan}</span>}
        <span className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{sub.phoneE164 ?? sub.phoneRaw ?? "—"}</span>
        {sub.lastInvite && <InviteBadge invite={sub.lastInvite} />}
      </div>
    </div>
  );
}

function InviteBadge({ invite }: { invite: LastInvite }) {
  const days = Math.floor((Date.now() - new Date(invite.sentAt).getTime()) / 86400000);
  const label = invite.status === "sent" ? `enviado ${days}d` : invite.status === "pending" ? "pendente" : "falhou";
  const color = invite.status === "sent" ? "rgba(0,229,160,0.85)" : invite.status === "pending" ? "#fbbf24" : "#fca5a5";
  return (
    <span title={`${new Date(invite.sentAt).toLocaleString("pt-PT")}${invite.error ? ` · ${invite.error}` : ""}`} style={{ fontSize: 11, color }}>
      · {label}
    </span>
  );
}

function SubRow({ sub, member }: { sub: Sub; member?: Member }) {
  return (
    <div style={rowStyle}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{sub.displayName}</span>
        {sub.plan && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{sub.plan}</span>}
        <span className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{sub.phoneE164 ?? sub.phoneRaw ?? "—"}</span>
      </div>
      {member && (
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
          {member.savedName ?? member.publicName ?? ""}
        </span>
      )}
    </div>
  );
}

function ExClientRow({ ex }: { ex: ExClient }) {
  const statusColor = ex.lastStatus === "active" ? "#00E5A0"
    : ex.lastStatus === "cancelled_running" ? "#fbbf24"
    : ex.lastStatus === "ended" ? "#fca5a5"
    : "rgba(255,255,255,0.5)";
  return (
    <div style={rowStyle}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", minWidth: 0, flex: 1, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{ex.displayName}</span>
        <span className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{ex.phoneE164 ?? ex.phoneRaw ?? "—"}</span>
        {ex.lastPlan && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{ex.lastPlan}</span>}
        {ex.lastStatus && <span style={{ fontSize: 11, color: statusColor }}>{ex.lastStatus}</span>}
        {ex.paidUntil && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>até {ex.paidUntil}</span>}
      </div>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
        {ex.member.savedName ?? ex.member.publicName ?? ""}
      </span>
    </div>
  );
}

function MemberRow({ member }: { member: Member }) {
  const name = member.savedName ?? member.publicName ?? member.phoneE164;
  return (
    <div style={rowStyle}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 13, color: "#fff" }}>{name}</span>
        <span className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{member.phoneE164}</span>
        {member.labels && <span style={{ fontSize: 11, color: "#fbbf24" }}>{member.labels}</span>}
        {member.isBusiness && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>business</span>}
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  background: "#0F0F14",
  border: "1px solid rgba(255,255,255,0.05)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const errBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  background: "rgba(239,68,68,0.12)",
  color: "#fca5a5",
  marginBottom: 16,
  fontSize: 13,
};

function btnStyle(variant: "primary" | "ghost", disabled?: boolean): React.CSSProperties {
  if (variant === "ghost") {
    return {
      fontSize: 12,
      fontWeight: 600,
      padding: "6px 12px",
      borderRadius: 6,
      background: "transparent",
      color: "rgba(255,255,255,0.7)",
      border: "1px solid rgba(255,255,255,0.15)",
      cursor: "pointer",
    };
  }
  return {
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 6,
    background: disabled ? "rgba(0,229,160,0.2)" : "rgba(0,229,160,0.85)",
    color: disabled ? "rgba(255,255,255,0.5)" : "#000",
    border: "none",
    cursor: disabled ? "default" : "pointer",
  };
}
