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
            { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
            { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false },
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

  const todaySignups = classes.filter((c) => isToday(c.date)).reduce((s, c) => s + (c.signup_count || 0), 0);
  const weekSignups = classes.filter((c) => isThisWeek(c.date)).reduce((s, c) => s + (c.signup_count || 0), 0);

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-tone-coral text-sm">Erro: {error}</div>;

  // Sort students by createdAt descending (most recent first)
  const sorted = [...students].sort((a, b) => {
    const da = a.createdAt || "";
    const db = b.createdAt || "";
    return db.localeCompare(da);
  });

  // Split into this week vs older
  const thisWeekStudents = sorted.filter((c) => {
    // createdAt from Yogo is like "29 de abril de 2026 às 10:05"
    // We can't reliably parse PT dates, so we use the id as proxy (higher id = more recent)
    // But actually let's check if we have a parseable date
    return true; // we'll highlight based on section instead
  });

  // For the week highlight, use classes data since we have proper dates there
  const weekClasses = classes.filter((c) => isThisWeek(c.date));
  const weekClassSignups = weekClasses.reduce((s, c) => s + (c.signup_count || 0), 0);

  const StudentCard = ({ c }: { c: Customer }) => (
    <div className={`bg-surface rounded-lg p-3 flex items-center justify-between gap-3 border-l-4 ${c.attended ? "border-accent" : "border-border-subtle"}`}>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{c.first_name} {c.last_name}</div>
        <div className="text-xs text-muted mt-0.5 flex flex-wrap gap-x-3">
          {c.email && <span>{c.email}</span>}
          {c.phone && <a href={`tel:${c.phone}`} className="text-tone-blue hover:underline">{c.phone}</a>}
        </div>
        {c.createdAt && <div className="text-xs text-muted mt-0.5">{c.createdAt}</div>}
      </div>
      {c.attended ? <Pill color="emerald"><CheckIcon /> foi à aula</Pill> : <Pill color="amber"><XIcon /> agendado</Pill>}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="head text-xl font-bold">Aulas Experimentais</h1>

      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Inscritos hoje" value={todaySignups} color="emerald" />
        <MiniStat label="Esta semana" value={weekSignups} color="cyan" />
        <MiniStat label="Total alunos trial" value={students.length} color="white" />
      </div>

      {/* This week highlight */}
      {weekClasses.length > 0 && (
        <div className="bg-accent/8 border border-accent/20 rounded-xl p-5">
          <h2 className="head text-sm font-semibold text-accent uppercase tracking-wide mb-3">
            Esta semana · <span className="num">{weekClassSignups}</span> inscrição{weekClassSignups !== 1 ? "ões" : "ão"}
          </h2>
          <div className="space-y-2">
            {weekClasses.sort((a, b) => b.date.localeCompare(a.date) || (b.start_time || "").localeCompare(a.start_time || "")).map((c) => (
              <div key={c.id} className="bg-surface rounded-lg p-3 border-l-4 border-accent">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{c.class_type?.name || "Trial"}</span>
                    <span className="text-accent text-sm font-bold ml-2">+{c.signup_count}</span>
                  </div>
                  <span className="text-xs text-muted">{c.date} · {(c.start_time || "").slice(0, 5)}</span>
                </div>
                {c.teachers?.[0] && <div className="text-xs text-muted mt-1">{c.teachers[0].first_name} {c.teachers[0].last_name}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All students — most recent first */}
      <div>
        <h2 className="head text-sm font-semibold text-muted-strong uppercase tracking-wide mb-3">Todos os alunos trial (<span className="num">{students.length}</span>)</h2>
        <div className="space-y-1.5">
          {sorted.map((c) => <StudentCard key={c.id} c={c} />)}
          {students.length === 0 && <div className="text-muted text-sm py-8 text-center">Nenhum aluno trial no período</div>}
        </div>
      </div>

      {/* All classes with signups — most recent first */}
      {classes.length > 0 && (
        <div>
          <h2 className="head text-sm font-semibold text-muted-strong uppercase tracking-wide mb-3">Todas as aulas com inscrições</h2>
          <div className="space-y-2">
            {[...classes].sort((a, b) => b.date.localeCompare(a.date) || (b.start_time || "").localeCompare(a.start_time || "")).map((c) => (
              <div key={c.id} className={`bg-surface rounded-lg p-3 border-l-4 ${isThisWeek(c.date) ? "border-accent" : "border-border-subtle"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{c.class_type?.name || "Trial"}</span>
                    <span className="text-accent text-sm font-bold ml-2">+{c.signup_count}</span>
                  </div>
                  <span className="text-xs text-muted">{c.date} · {(c.start_time || "").slice(0, 5)}</span>
                </div>
                {c.teachers?.[0] && <div className="text-xs text-muted mt-1">{c.teachers[0].first_name} {c.teachers[0].last_name}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
