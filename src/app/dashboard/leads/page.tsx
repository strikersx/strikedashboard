"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { LoaderIcon } from "@/components/icons";
import { isNonActionableLead, fmtDate, getDashboardRange, getYesterday } from "@/lib/utils";
import { TRIAL_CLASS_PASS_ID, TRIAL_CLASS_TYPE_ID } from "@/lib/constants";
import { TrialRow } from "@/components/trial-row";

// ===== Interessados (Cold leads without trial) =====
interface LeadCustomer {
  id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  createdAt?: string;
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

function LeadsInterested() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchReport("reports/customers", {
        filters: [
          { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
          { type: "hasNoClassPass", classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveClassPasses: false },
        ],
        returnColumnHeaders: true,
      });

      const parseYogoDate = (s: string): number => {
        const MONTHS: Record<string, number> = {
          janeiro: 1, fevereiro: 2, março: 3, abril: 4, maio: 5, junho: 6,
          julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
        };
        const m = s.match(/(\d+) de (\w+) de (\d{4})(?: às (\d{2}):(\d{2}))?/);
        if (!m) return 0;
        const [, d, mon, y, h = "0", min = "0"] = m;
        const month = MONTHS[mon.toLowerCase()];
        if (!month) return 0;
        return new Date(+y, month - 1, +d, +h, +min).getTime();
      };

      const actionable = (rows as unknown as LeadCustomer[])
        .filter((c) => !isNonActionableLead(c))
        .map((c) => ({
          name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sem nome",
          email: c.email || "—",
          phone: c.phone || "—",
          createdAt: c.createdAt || "—",
        }))
        .sort((a, b) => parseYogoDate(b.createdAt) - parseYogoDate(a.createdAt));

      setLeads(actionable);
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
      <div style={{ padding: "0 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
        <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>Interessados</h3>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{leads.length}</span>
      </div>

      <div style={{ padding: "4px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        {leads.length === 0 ? (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
            Nenhum lead encontrado.
          </div>
        ) : (
          leads.map((l, i) => (
            <LeadRow key={i} {...l} />
          ))
        )}
      </div>
    </div>
  );
}

// ===== Follow-up (Trial passes, attended vs no-show) =====
interface TrialCustomer {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  attended?: boolean;
}

interface ClassItem {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  signup_count?: number;
  class_type?: { name?: string };
  teachers?: { first_name?: string; last_name?: string }[];
}

function LeadsFollowup() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchYogo, fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<TrialCustomer[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [tab, setTab] = useState<"hot" | "cold">("hot");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = fmtDate(new Date());
      const sixMonthsAgo = fmtDate(new Date(new Date().setMonth(new Date().getMonth() - 6)));
      const { startDate, endDate } = getDashboardRange();
      const yesterday = getYesterday();

      const [allTrial, attendedTrial, classesRaw] = await Promise.all([
        fetchReport("reports/customers", {
          filters: [
            { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
            { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false },
            { type: "numberOfSignups", classTypeId: [TRIAL_CLASS_TYPE_ID], membershipTypeId: [], conditionType: "greaterThanOrEquals", conditionAmount: 1, averagePerTimeUnit: "month", startDate: sixMonthsAgo, endDate: yesterday, includeClassSignups: true, onlyCheckedInClassSignups: false, includeWaitingListSignups: false, includeLivestreamSignups: false, includeZeroSignups: false },
          ],
          returnColumnHeaders: true,
        }),
        fetchReport("reports/customers", {
          filters: [
            { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
            { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false },
            { type: "numberOfSignups", classTypeId: [TRIAL_CLASS_TYPE_ID], membershipTypeId: [], conditionType: "greaterThanOrEquals", conditionAmount: 1, averagePerTimeUnit: "month", startDate: sixMonthsAgo, endDate: today, includeClassSignups: true, onlyCheckedInClassSignups: true, includeWaitingListSignups: false, includeLivestreamSignups: false, includeZeroSignups: false },
          ],
          returnColumnHeaders: true,
        }),
        fetchYogo(`classes?startDate=${startDate}&endDate=${endDate}&class_type[]=${TRIAL_CLASS_TYPE_ID}&populate[]=class_type&populate[]=teachers&populate[]=signup_count&sort[]=date ASC&sort[]=start_time ASC`),
      ]);

      const attendedIds = new Set(attendedTrial.map((t: Record<string, unknown>) => t.id));
      const enriched = allTrial.map((t: Record<string, unknown>) => ({ ...t, attended: attendedIds.has(t.id) }));
      setStudents(enriched as TrialCustomer[]);

      const classList: ClassItem[] = Array.isArray(classesRaw) ? classesRaw : (classesRaw as { classes?: ClassItem[] })?.classes ?? [];
      setClasses(classList.filter((c) => (c.signup_count || 0) > 0));

      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [fetchYogo, fetchReport, setLastFetch]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-tone-coral text-sm">Erro: {error}</div>;

  const went = students.filter((s) => s.attended);
  const noshow = students.filter((s) => !s.attended);
  const list = tab === "hot" ? went : noshow;

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Split stat cards */}
      <div style={{ padding: "4px 18px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          onClick={() => setTab("hot")}
          style={{
            padding: 14, borderRadius: 14, cursor: "pointer", textAlign: "left",
            background: tab === "hot" ? "rgba(255,46,136,0.08)" : "#0F0F14",
            border: `1px solid ${tab === "hot" ? "#FF2E88" : "rgba(255,255,255,0.06)"}`,
            color: "#fff", fontFamily: "inherit",
          }}
          className="tap"
        >
          <div className="head" style={{ fontSize: 10, color: "#FF2E88", marginBottom: 6 }}>FORAM À AULA</div>
          <div className="num" style={{ fontSize: 38, color: "#fff" }}>{went.length}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4, lineHeight: 1.3 }}>
            Lead quente — fechar venda 24-48h
          </div>
        </button>
        <button
          onClick={() => setTab("cold")}
          style={{
            padding: 14, borderRadius: 14, cursor: "pointer", textAlign: "left",
            background: tab === "cold" ? "rgba(255,182,39,0.08)" : "#0F0F14",
            border: `1px solid ${tab === "cold" ? "#FFB627" : "rgba(255,255,255,0.06)"}`,
            color: "#fff", fontFamily: "inherit",
          }}
          className="tap"
        >
          <div className="head" style={{ fontSize: 10, color: "#FFB627", marginBottom: 6 }}>FALTARAM</div>
          <div className="num" style={{ fontSize: 38, color: "#fff" }}>{noshow.length}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4, lineHeight: 1.3 }}>
            No-show — confirmar e reagendar
          </div>
        </button>
      </div>

      {/* List */}
      <div style={{ padding: "4px 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
        <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>
          {tab === "hot" ? "Foram à aula" : "Faltaram ou agendado"}
        </h3>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{list.length}</span>
      </div>
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((t) => (
          <TrialRow
            key={t.id}
            name={`${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || "Sem nome"}
            phone={t.phone}
            registeredAt={t.createdAt ? String(t.createdAt).replace(/ às \d{2}:\d{2}.*/, "") : undefined}
            attended={t.attended ?? false}
          />
        ))}
        {list.length === 0 && (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
            Nenhum registo nesta categoria.
          </div>
        )}
      </div>

      {/* Trial classes section */}
      {classes.length > 0 && (
        <>
          <div style={{ padding: "18px 18px 10px" }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>
              Aulas Experimentais <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{classes.length}</span>
            </h3>
          </div>
          <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
            {classes.map((c) => (
              <div
                key={c.id}
                style={{ background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 12px" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                      {c.date} · {c.start_time?.slice(0, 5)}
                    </div>
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                      {c.class_type?.name ?? "Experimental"}
                      {c.teachers?.[0] && ` · ${c.teachers[0].first_name} ${c.teachers[0].last_name}`}
                    </div>
                  </div>
                  <span className="num" style={{ fontSize: 22, color: "#00E5A0" }}>{c.signup_count}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ===== Main Leads Hub =====
export default function LeadsPage() {
  const [tab, setTab] = useState<"interested" | "followup">("interested");

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Page header */}
      <div style={{ padding: "4px 18px 14px" }}>
        <h1 className="head" style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>
          Leads
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          Gestão do funil de conversão
        </p>
      </div>

      {/* Sub-tabs */}
      <div style={{ padding: "0 18px 14px", display: "flex", gap: 8 }}>
        <button
          onClick={() => setTab("interested")}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 10,
            background: tab === "interested" ? "#00E5A0" : "#0F0F14",
            border: `1px solid ${tab === "interested" ? "#00E5A0" : "rgba(255,255,255,0.06)"}`,
            color: tab === "interested" ? "#0a0a0a" : "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          className="tap"
        >
          Interessados
        </button>
        <button
          onClick={() => setTab("followup")}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 10,
            background: tab === "followup" ? "#FF9500" : "#0F0F14",
            border: `1px solid ${tab === "followup" ? "#FF9500" : "rgba(255,255,255,0.06)"}`,
            color: tab === "followup" ? "#0a0a0a" : "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          className="tap"
        >
          Follow-up
        </button>
      </div>

      {/* Content */}
      {tab === "interested" && <LeadsInterested />}
      {tab === "followup" && <LeadsFollowup />}
    </div>
  );
}
