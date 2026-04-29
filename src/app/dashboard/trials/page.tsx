"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { LoaderIcon } from "@/components/icons";
import { fmtDate, getDashboardRange, getYesterday } from "@/lib/utils";
import { TRIAL_CLASS_TYPE_ID, TRIAL_CLASS_PASS_ID } from "@/lib/constants";
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

interface ClassItem {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  signup_count?: number;
  class_type?: { name?: string };
  teachers?: { first_name?: string; last_name?: string }[];
}

export default function TrialsPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchYogo, fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<Customer[]>([]);
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
        // Customers with trial pass who had a class signup BEFORE today (past only — excludes future-scheduled)
        fetchReport("reports/customers", {
          filters: [
            { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
            { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false },
            { type: "numberOfSignups", classTypeId: [TRIAL_CLASS_TYPE_ID], membershipTypeId: [], conditionType: "greaterThanOrEquals", conditionAmount: 1, averagePerTimeUnit: "month", startDate: sixMonthsAgo, endDate: yesterday, includeClassSignups: true, onlyCheckedInClassSignups: false, includeWaitingListSignups: false, includeLivestreamSignups: false, includeZeroSignups: false },
          ],
          returnColumnHeaders: true,
        }),
        // Those who actually attended
        fetchReport("reports/customers", {
          filters: [
            { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
            { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false },
            { type: "numberOfSignups", classTypeId: [TRIAL_CLASS_TYPE_ID], membershipTypeId: [], conditionType: "greaterThanOrEquals", conditionAmount: 1, averagePerTimeUnit: "month", startDate: sixMonthsAgo, endDate: today, includeClassSignups: true, onlyCheckedInClassSignups: true, includeWaitingListSignups: false, includeLivestreamSignups: false, includeZeroSignups: false },
          ],
          returnColumnHeaders: true,
        }),
        // Trial classes for schedule view
        fetchYogo(`classes?startDate=${startDate}&endDate=${endDate}&class_type[]=${TRIAL_CLASS_TYPE_ID}&populate[]=class_type&populate[]=teachers&populate[]=signup_count&sort[]=date ASC&sort[]=start_time ASC`),
      ]);

      const attendedIds = new Set(attendedTrial.map((t: Record<string, unknown>) => t.id));
      const enriched = allTrial.map((t: Record<string, unknown>) => ({ ...t, attended: attendedIds.has(t.id) }));
      setStudents(enriched as Customer[]);

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
