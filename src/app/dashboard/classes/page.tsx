"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { MiniStat } from "@/components/mini-stat";
import { ClassList } from "@/components/class-list";
import { LoaderIcon } from "@/components/icons";
import { fmtDate, isToday, isThisWeek } from "@/lib/utils";

interface ClassItem {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  signup_count?: number;
  checked_in_count?: number;
  waiting_list_count?: number;
  urban_sports_club_signup_count?: number;
  classpass_com_signup_count?: number;
  bruce_app_signup_count?: number;
  class_type?: { name?: string };
  teachers?: { first_name?: string; last_name?: string }[];
  room?: { name?: string };
}

function hasVisitors(c: ClassItem): boolean {
  return (
    (c.urban_sports_club_signup_count || 0) > 0 ||
    (c.classpass_com_signup_count || 0) > 0 ||
    (c.bruce_app_signup_count || 0) > 0
  );
}

function visitorCount(c: ClassItem): number {
  return (
    (c.urban_sports_club_signup_count || 0) +
    (c.classpass_com_signup_count || 0) +
    (c.bruce_app_signup_count || 0)
  );
}

export default function ClassesPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchYogo } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = fmtDate(new Date());
      const end = new Date();
      end.setDate(end.getDate() + 30);
      const endDate = fmtDate(end);
      const params = new URLSearchParams({ startDate, endDate });
      [
        "class_type",
        "teachers",
        "room",
        "room.branch",
        "signup_count",
        "checked_in_count",
        "waiting_list_count",
        "waiting_list_max",
        "livestream_signup_count",
        "classpass_com_signup_count",
        "bruce_app_signup_count",
        "urban_sports_club_signup_count",
      ].forEach((p) => params.append("populate[]", p));
      params.append("sort[]", "date ASC");
      params.append("sort[]", "start_time ASC");

      const raw = await fetchYogo("classes?" + params.toString());
      const list: ClassItem[] = Array.isArray(raw) ? raw : (raw as { classes?: ClassItem[] })?.classes ?? [];

      const withVisitors = list.filter(hasVisitors);
      setClasses(withVisitors);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [fetchYogo, setLastFetch]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const todayVisitors = classes.filter((c) => isToday(c.date)).reduce((s, c) => s + visitorCount(c), 0);
  const weekVisitors = classes.filter((c) => isThisWeek(c.date)).reduce((s, c) => s + visitorCount(c), 0);
  const totalVisitors = classes.reduce((s, c) => s + visitorCount(c), 0);

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-tone-coral text-sm">Erro: {error}</div>;

  return (
    <div className="space-y-6">
      <h1 className="head text-xl font-bold">Aulas com Visitantes (USC / CP / Bruce)</h1>

      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Hoje" value={todayVisitors} color="blue" />
        <MiniStat label="Esta semana" value={weekVisitors} color="purple" />
        <MiniStat label="Total (período)" value={totalVisitors} color="white" />
      </div>

      <ClassList classes={classes} mode="visitors" empty="Sem aulas com visitantes no período" />
    </div>
  );
}
