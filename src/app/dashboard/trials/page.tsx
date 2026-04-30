"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { LoaderIcon } from "@/components/icons";
import { TRIAL_CLASS_TYPE_ID } from "@/lib/constants";

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
  const { fetchYogo } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeekClasses, setCurrentWeekClasses] = useState<ClassItem[]>([]);
  const [nextWeekClasses, setNextWeekClasses] = useState<ClassItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();

      // Current week: today to end of week (Sunday)
      const dayOfWeek = today.getDay();
      const daysUntilEndOfWeek = 6 - dayOfWeek; // 6 = Sunday
      const endOfCurrentWeek = new Date(today);
      endOfCurrentWeek.setDate(today.getDate() + daysUntilEndOfWeek);
      endOfCurrentWeek.setHours(23, 59, 59, 999);

      // Next week: Monday to Sunday
      const startOfNextWeek = new Date(endOfCurrentWeek);
      startOfNextWeek.setDate(endOfCurrentWeek.getDate() + 1);
      startOfNextWeek.setHours(0, 0, 0, 0);

      const endOfNextWeek = new Date(startOfNextWeek);
      endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
      endOfNextWeek.setHours(23, 59, 59, 999);

      const formatDate = (d: Date): string => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      // Fetch both weeks
      const [currentWeekData, nextWeekData] = await Promise.all([
        fetchYogo(`classes?startDate=${formatDate(today)}&endDate=${formatDate(endOfCurrentWeek)}&class_type[]=${TRIAL_CLASS_TYPE_ID}&populate[]=class_type&populate[]=teachers&populate[]=signup_count&sort[]=date ASC&sort[]=start_time ASC`),
        fetchYogo(`classes?startDate=${formatDate(startOfNextWeek)}&endDate=${formatDate(endOfNextWeek)}&class_type[]=${TRIAL_CLASS_TYPE_ID}&populate[]=class_type&populate[]=teachers&populate[]=signup_count&sort[]=date ASC&sort[]=start_time ASC`),
      ]);

      const parseClasses = (data: unknown): ClassItem[] => {
        if (Array.isArray(data)) return data;
        if (data && typeof data === "object" && "classes" in data) return (data as { classes?: ClassItem[] }).classes ?? [];
        return [];
      };

      const currentWeek = parseClasses(currentWeekData).filter((c) => (c.signup_count || 0) > 0);
      const nextWeek = parseClasses(nextWeekData).filter((c) => (c.signup_count || 0) > 0);

      setCurrentWeekClasses(currentWeek);
      setNextWeekClasses(nextWeek);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [fetchYogo, setLastFetch]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-tone-coral text-sm">Erro: {error}</div>;

  return (
    <div style={{ paddingBottom: 32 }}>
      <div style={{ padding: "4px 18px 14px" }}>
        <h1 className="head" style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>
          Trials
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          Aulas experimentais agendadas
        </p>
      </div>

      {/* Current week */}
      {currentWeekClasses.length > 0 && (
        <div>
          <div style={{ padding: "10px 18px 6px" }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>
              Esta Semana <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{currentWeekClasses.length}</span>
            </h3>
          </div>
          <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            {currentWeekClasses.map((c) => (
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
        </div>
      )}

      {/* Next week */}
      {nextWeekClasses.length > 0 && (
        <div>
          <div style={{ padding: "10px 18px 6px" }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>
              Próxima Semana <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{nextWeekClasses.length}</span>
            </h3>
          </div>
          <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            {nextWeekClasses.map((c) => (
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
        </div>
      )}

      {currentWeekClasses.length === 0 && nextWeekClasses.length === 0 && (
        <div style={{ padding: "20px 18px", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
          Nenhuma aula experimental agendada.
        </div>
      )}
    </div>
  );
}
