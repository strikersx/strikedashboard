"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { MiniStat } from "@/components/mini-stat";
import { Pill } from "@/components/pill";
import { LoaderIcon, CheckIcon, XIcon } from "@/components/icons";
import { fmtDate, getDashboardRange, isToday, isThisWeek } from "@/lib/utils";
import { TRIAL_CLASS_TYPE_ID, TRIAL_CLASS_PASS_ID } from "@/lib/constants";

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = fmtDate(new Date());
      const sixMonthsAgo = fmtDate(new Date(new Date().setMonth(new Date().getMonth() - 6)));
      const { startDate, endDate } = getDashboardRange();

      const [allTrial, attendedTrial, classesRaw] = await Promise.all([
        // All customers with trial class pass
        fetchReport("reports/customers", {
          filters: [
            { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false },
          ],
          returnColumnHeaders: true,
        }),
        // Those who actually attended
        fetchReport("reports/customers", {
          filters: [
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

  const todaySignups = classes.filter((c) => isToday(c.date)).reduce((s, c) => s + (c.signup_count || 0), 0);
  const weekSignups = classes.filter((c) => isThisWeek(c.date)).reduce((s, c) => s + (c.signup_count || 0), 0);

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-red-500 text-sm">Erro: {error}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Aulas Experimentais</h1>

      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Inscritos hoje" value={todaySignups} color="emerald" />
        <MiniStat label="Esta semana" value={weekSignups} color="cyan" />
        <MiniStat label="Total alunos trial" value={students.length} color="white" />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Alunos com aula experimental ({students.length})</h2>
        <div className="space-y-1.5">
          {students.map((c) => (
            <div key={c.id} className={`bg-black/40 rounded-lg p-3 flex items-center justify-between gap-3 border-l-4 ${c.attended ? "border-emerald-500" : "border-zinc-700"}`}>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{c.first_name} {c.last_name}</div>
                <div className="text-xs text-zinc-500 mt-0.5 flex flex-wrap gap-x-3">
                  {c.email && <span>{c.email}</span>}
                  {c.phone && <a href={`tel:${c.phone}`} className="text-blue-400 hover:underline">{c.phone}</a>}
                </div>
                {c.createdAt && <div className="text-xs text-zinc-600 mt-0.5">{c.createdAt}</div>}
              </div>
              {c.attended ? <Pill color="emerald"><CheckIcon /> foi à aula</Pill> : <Pill color="amber"><XIcon /> agendado</Pill>}
            </div>
          ))}
          {students.length === 0 && <div className="text-zinc-500 text-sm py-8 text-center">Nenhum aluno trial no período</div>}
        </div>
      </div>

      {classes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Aulas com inscrições</h2>
          <div className="space-y-2">
            {classes.map((c) => (
              <div key={c.id} className="bg-black/40 rounded-lg p-3 border-l-4 border-emerald-500">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{c.class_type?.name || "Trial"}</span>
                    <span className="text-emerald-400 text-sm font-bold ml-2">+{c.signup_count}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{c.date} · {(c.start_time || "").slice(0, 5)}</span>
                </div>
                {c.teachers?.[0] && <div className="text-xs text-zinc-500 mt-1">{c.teachers[0].first_name} {c.teachers[0].last_name}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
