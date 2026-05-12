"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { LoaderIcon } from "@/components/icons";
import { isNonActionableLead, fmtDate, getYesterday, parseYogoDate } from "@/lib/utils";
import { TRIAL_CLASS_PASS_ID, TRIAL_CLASS_TYPE_ID } from "@/lib/constants";
import { TrialRow } from "@/components/trial-row";

interface Customer {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  attended?: boolean;
}

interface Lead {
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

function LeadRow({ name, email, phone, createdAt }: Lead) {
  return (
    <div style={{
      background: "#0F0F14",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12,
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", lineHeight: 1.3 }}>{name}</span>
        {phone && phone !== "—" && (
          <span style={{ fontSize: 12, color: "#A6E22E", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>{phone}</span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
        {createdAt && createdAt !== "—" && (
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap", flexShrink: 0 }}>
            {String(createdAt).replace(/ às \d{2}:\d{2}.*/, "")}
          </span>
        )}
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interessados, setInteressados] = useState<Lead[]>([]);
  const [foram, setForam] = useState<Customer[]>([]);
  const [faltaram, setFaltaram] = useState<Customer[]>([]);
  const [marcaram, setMarcaram] = useState<Customer[]>([]);
  const [tab, setTab] = useState<"foram" | "faltaram" | "marcaram" | "interessados">("foram");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = fmtDate(new Date());
      const sixMonthsAgo = fmtDate(new Date(new Date().setMonth(new Date().getMonth() - 6)));
      const yesterday = getYesterday();

      // Interessados: no membership, no passes of any kind
      const interessadosRows = await fetchReport("reports/customers", {
        filters: [
          { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
          { type: "hasNoClassPass", classPassTypeId: [], onlyActiveClassPasses: false },
        ],
        returnColumnHeaders: true,
      });

      // Trial people who attended
      const attendedRows = await fetchReport("reports/customers", {
        filters: [
          { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
          { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false },
          { type: "numberOfSignups", classTypeId: [TRIAL_CLASS_TYPE_ID], membershipTypeId: [], conditionType: "greaterThanOrEquals", conditionAmount: 1, averagePerTimeUnit: "month", startDate: sixMonthsAgo, endDate: today, includeClassSignups: true, onlyCheckedInClassSignups: true, includeWaitingListSignups: false, includeLivestreamSignups: false, includeZeroSignups: false },
        ],
        returnColumnHeaders: true,
      });

      // Trial people who didn't attend
      const noshowRows = await fetchReport("reports/customers", {
        filters: [
          { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
          { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false },
          { type: "numberOfSignups", classTypeId: [TRIAL_CLASS_TYPE_ID], membershipTypeId: [], conditionType: "greaterThanOrEquals", conditionAmount: 1, averagePerTimeUnit: "month", startDate: sixMonthsAgo, endDate: yesterday, includeClassSignups: true, onlyCheckedInClassSignups: false, includeWaitingListSignups: false, includeLivestreamSignups: false, includeZeroSignups: false },
        ],
        returnColumnHeaders: true,
      });

      // Trial people who marked pass but never scheduled a class
      const marcaramRows = await fetchReport("reports/customers", {
        filters: [
          { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
          { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false },
          { type: "numberOfSignups", classTypeId: [TRIAL_CLASS_TYPE_ID], membershipTypeId: [], conditionType: "equals", conditionAmount: 0, averagePerTimeUnit: "month", startDate: sixMonthsAgo, endDate: today, includeClassSignups: true, onlyCheckedInClassSignups: false, includeWaitingListSignups: false, includeLivestreamSignups: false, includeZeroSignups: true },
        ],
        returnColumnHeaders: true,
      });

      // Get attended IDs to filter out from noshow
      const attendedIds = new Set((attendedRows as unknown as Customer[]).map((c) => c.id));
      const noshowFiltered = (noshowRows as unknown as Customer[]).filter((c) => !attendedIds.has(c.id));

      // Filter out non-actionable leads from all tabs, then sort by createdAt DESC
      const byCreatedAtDesc = (a: Customer, b: Customer) =>
        parseYogoDate(b.createdAt) - parseYogoDate(a.createdAt);
      const actionableFoam = (attendedRows as unknown as Customer[])
        .filter((c) => !isNonActionableLead(c))
        .sort(byCreatedAtDesc);
      const actionableFaltaram = noshowFiltered
        .filter((c) => !isNonActionableLead(c))
        .sort(byCreatedAtDesc);
      const actionableMarcaram = (marcaramRows as unknown as Customer[])
        .filter((c) => !isNonActionableLead(c))
        .sort(byCreatedAtDesc);

      const interessadosList = (interessadosRows as unknown as Customer[])
        .filter((c) => !isNonActionableLead(c))
        .map((c) => ({
          name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sem nome",
          email: c.email || "—",
          phone: c.phone || "—",
          createdAt: c.createdAt || "—",
        }))
        .sort((a, b) => parseYogoDate(b.createdAt) - parseYogoDate(a.createdAt));

      setForam(actionableFoam);
      setFaltaram(actionableFaltaram);
      setMarcaram(actionableMarcaram);
      setInteressados(interessadosList);
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

  return (
    <div style={{ paddingBottom: 32 }}>
      <div style={{ padding: "4px 18px 14px" }}>
        <h1 className="head" style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>
          Leads
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          Gestão de pessoas no funil
        </p>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 18px 14px", display: "flex", gap: 6 }}>
        <button
          onClick={() => setTab("foram")}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            background: tab === "foram" ? "#FF2E88" : "#0F0F14",
            border: `1px solid ${tab === "foram" ? "#FF2E88" : "rgba(255,255,255,0.06)"}`,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          className="tap"
        >
          Foram à Aula
        </button>
        <button
          onClick={() => setTab("faltaram")}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            background: tab === "faltaram" ? "#FFB627" : "#0F0F14",
            border: `1px solid ${tab === "faltaram" ? "#FFB627" : "rgba(255,255,255,0.06)"}`,
            color: tab === "faltaram" ? "#0a0a0a" : "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          className="tap"
        >
          Faltaram
        </button>
        <button
          onClick={() => setTab("marcaram")}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            background: tab === "marcaram" ? "#9B59B6" : "#0F0F14",
            border: `1px solid ${tab === "marcaram" ? "#9B59B6" : "rgba(255,255,255,0.06)"}`,
            color: tab === "marcaram" ? "#fff" : "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          className="tap"
        >
          Agendaram passe
        </button>
        <button
          onClick={() => setTab("interessados")}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            background: tab === "interessados" ? "#00E5A0" : "#0F0F14",
            border: `1px solid ${tab === "interessados" ? "#00E5A0" : "rgba(255,255,255,0.06)"}`,
            color: tab === "interessados" ? "#0a0a0a" : "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          className="tap"
        >
          Interessados
        </button>
      </div>

      {/* Content */}
      {tab === "foram" && (
        <div>
          <div style={{ padding: "0 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>Foram à Aula</h3>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{foram.length}</span>
          </div>
          <div style={{ padding: "4px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {foram.length === 0 ? (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
                Nenhum registo nesta categoria.
              </div>
            ) : (
              foram.map((t) => (
                <TrialRow
                  key={t.id}
                  name={`${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || "Sem nome"}
                  phone={t.phone}
                  registeredAt={t.createdAt ? String(t.createdAt).replace(/ às \d{2}:\d{2}.*/, "") : undefined}
                  attended={true}
                />
              ))
            )}
          </div>
        </div>
      )}

      {tab === "faltaram" && (
        <div>
          <div style={{ padding: "0 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>Faltaram</h3>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{faltaram.length}</span>
          </div>
          <div style={{ padding: "4px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {faltaram.length === 0 ? (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
                Nenhum registo nesta categoria.
              </div>
            ) : (
              faltaram.map((t) => (
                <TrialRow
                  key={t.id}
                  name={`${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || "Sem nome"}
                  phone={t.phone}
                  registeredAt={t.createdAt ? String(t.createdAt).replace(/ às \d{2}:\d{2}.*/, "") : undefined}
                  attended={false}
                />
              ))
            )}
          </div>
        </div>
      )}

      {tab === "marcaram" && (
        <div>
          <div style={{ padding: "0 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>Agendaram passe</h3>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{marcaram.length}</span>
          </div>
          <div style={{ padding: "4px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {marcaram.length === 0 ? (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
                Nenhum registo nesta categoria.
              </div>
            ) : (
              marcaram.map((t) => (
                <TrialRow
                  key={t.id}
                  name={`${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || "Sem nome"}
                  phone={t.phone}
                  registeredAt={t.createdAt ? String(t.createdAt).replace(/ às \d{2}:\d{2}.*/, "") : undefined}
                  attended={undefined}
                />
              ))
            )}
          </div>
        </div>
      )}

      {tab === "interessados" && (
        <div>
          <div style={{ padding: "0 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>Interessados</h3>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{interessados.length}</span>
          </div>
          <div style={{ padding: "4px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {interessados.length === 0 ? (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
                Nenhum lead encontrado.
              </div>
            ) : (
              interessados.map((l, i) => (
                <LeadRow key={i} {...l} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
