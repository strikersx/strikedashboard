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
  const [attended, setAttended] = useState<Customer[]>([]);
  const [noshow, setNoshow] = useState<Customer[]>([]);
  const [scheduled, setScheduled] = useState<Customer[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [tab, setTab] = useState<"agendadas" | "foram" | "faltaram">("agendadas");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = fmtDate(new Date());
      const sixMonthsAgo = fmtDate(new Date(new Date().setMonth(new Date().getMonth() - 6)));
      const { startDate, endDate } = getDashboardRange();
      const yesterday = getYesterday();

      const [allTrial, attendedTrial, classesRaw] = await Promise.all([
        // All with trial pass who had signup before today
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
        // Trial classes
        fetchYogo(`classes?startDate=${startDate}&endDate=${endDate}&class_type[]=${TRIAL_CLASS_TYPE_ID}&populate[]=class_type&populate[]=teachers&populate[]=signup_count&sort[]=date ASC&sort[]=start_time ASC`),
      ]);

      const attendedIds = new Set(attendedTrial.map((t: Record<string, unknown>) => t.id));
      const enriched = allTrial.map((t: Record<string, unknown>) => ({ ...t, attended: attendedIds.has(t.id) }));

      const attendedList = enriched.filter((c: Customer) => c.attended);
      const noshowList = enriched.filter((c: Customer) => !c.attended);

      setAttended(attendedList as Customer[]);
      setNoshow(noshowList as Customer[]);

      // For scheduled (future): get all with trial pass, no class signups yet or future signups
      setScheduled(enriched.filter((c: Customer) => !c.attended) as Customer[]);

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

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Page header */}
      <div style={{ padding: "4px 18px 14px" }}>
        <h1 className="head" style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>
          Trials
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          Aulas experimentais
        </p>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 18px 14px", display: "flex", gap: 6 }}>
        <button
          onClick={() => setTab("agendadas")}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            background: tab === "agendadas" ? "#00E5A0" : "#0F0F14",
            border: `1px solid ${tab === "agendadas" ? "#00E5A0" : "rgba(255,255,255,0.06)"}`,
            color: tab === "agendadas" ? "#0a0a0a" : "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          className="tap"
        >
          Agendadas
        </button>
        <button
          onClick={() => setTab("foram")}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            background: tab === "foram" ? "#FF2E88" : "#0F0F14",
            border: `1px solid ${tab === "foram" ? "#FF2E88" : "rgba(255,255,255,0.06)"}`,
            color: tab === "foram" ? "#fff" : "#fff",
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
      </div>

      {/* Content */}
      {tab === "agendadas" && (
        <div>
          <div style={{ padding: "0 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>Aulas Agendadas</h3>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{classes.length}</span>
          </div>
          <div style={{ padding: "4px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
            {classes.length === 0 ? (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
                Nenhuma aula agendada.
              </div>
            ) : (
              classes.map((c) => (
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
              ))
            )}
          </div>
        </div>
      )}

      {tab === "foram" && (
        <div>
          <div style={{ padding: "0 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>Foram à Aula</h3>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{attended.length}</span>
          </div>
          <div style={{ padding: "4px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {attended.length === 0 ? (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
                Nenhum registo nesta categoria.
              </div>
            ) : (
              attended.map((t) => (
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
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{noshow.length}</span>
          </div>
          <div style={{ padding: "4px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {noshow.length === 0 ? (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
                Nenhum registo nesta categoria.
              </div>
            ) : (
              noshow.map((t) => (
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
    </div>
  );
}
