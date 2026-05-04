"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { LoaderIcon } from "@/components/icons";
import { getPlan, isPTPlan, eur } from "@/lib/utils";
import { PLAN_VALUES } from "@/lib/constants";

interface Membership {
  user_id?: number;
  membership_type_name?: string;
  paid_until?: string;
  status?: string;
}

type DayEntry = { recurring: number; pt: number };

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Returns 0=Mon … 6=Sun (European calendar)
function getFirstWeekday(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function buildDayMap(memberships: Membership[], year: number, month: number): Map<string, DayEntry> {
  const map = new Map<string, DayEntry>();
  const daysInMonth = getDaysInMonth(year, month);

  for (const m of memberships) {
    if (!m.paid_until) continue;
    const plan = getPlan(m.membership_type_name);
    const value = PLAN_VALUES[plan] ?? 0;
    if (value === 0) continue;

    const parts = m.paid_until.split("-");
    const baseYear = parseInt(parts[0]);
    const baseMonth = parseInt(parts[1]) - 1;
    const baseDay = parseInt(parts[2]);

    if (isPTPlan(plan)) {
      // PT passes: only show on their actual paid_until date
      if (baseYear === year && baseMonth === month) {
        const entry = map.get(m.paid_until) ?? { recurring: 0, pt: 0 };
        map.set(m.paid_until, { ...entry, pt: entry.pt + value });
      }
    } else {
      // Recurring: project the renewal day to the selected month
      // Members with baseYM < selectedYM have lapsed — skip them
      const baseYM = baseYear * 12 + baseMonth;
      const selectedYM = year * 12 + month;
      if (baseYM < selectedYM) continue;

      const projectedDay = Math.min(baseDay, daysInMonth);
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(projectedDay).padStart(2, "0")}`;
      const entry = map.get(key) ?? { recurring: 0, pt: 0 };
      map.set(key, { ...entry, recurring: entry.recurring + value });
    }
  }

  return map;
}

export default function AReceberPage() {
  const today = new Date();
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchReport("reports/memberships-list", {});
      setMemberships(raw as unknown as Membership[]);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [fetchReport, setLastFetch]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedYear((y) => y - 1); setSelectedMonth(11); }
    else setSelectedMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedYear((y) => y + 1); setSelectedMonth(0); }
    else setSelectedMonth((m) => m + 1);
  };

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-tone-coral text-sm">Erro: {error}</div>;

  const isFuture =
    selectedYear > today.getFullYear() ||
    (selectedYear === today.getFullYear() && selectedMonth > today.getMonth());
  const isCurrentMonth =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth();
  const todayStr = today.toISOString().slice(0, 10);

  const dayMap = buildDayMap(memberships, selectedYear, selectedMonth);

  let totalRecurring = 0;
  let totalPT = 0;
  for (const entry of dayMap.values()) {
    totalRecurring += entry.recurring;
    totalPT += entry.pt;
  }

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const firstWeekday = getFirstWeekday(selectedYear, selectedMonth);
  const trailingCells = (7 - ((firstWeekday + daysInMonth) % 7)) % 7;

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Month navigation */}
      <div style={{ padding: "4px 18px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          onClick={prevMonth}
          className="tap"
          style={{ padding: "8px 16px", background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: "rgba(255,255,255,0.72)", cursor: "pointer", fontSize: 18, fontFamily: "inherit" }}
        >
          ←
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="head" style={{ fontSize: 17, color: "#fff" }}>
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </span>
          {isFuture && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 999, background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.18)" }}>
              ESTIMATIVA
            </span>
          )}
        </div>

        <button
          onClick={nextMonth}
          className="tap"
          style={{ padding: "8px 16px", background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: "rgba(255,255,255,0.72)", cursor: "pointer", fontSize: 18, fontFamily: "inherit" }}
        >
          →
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ padding: "0 18px 16px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[
          { label: "TOTAL", value: eur(totalRecurring + totalPT), color: "#fff" },
          { label: "RECORRENTES", value: eur(totalRecurring), color: "#00E5A0" },
          { label: "PTs", value: eur(totalPT), color: "#A78BFA" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 10px" }}>
            <div className="head" style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: "0.06em" }}>
              {label}
            </div>
            <div className="num" style={{ fontSize: 20, color, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div style={{ padding: "0 18px" }}>
        {/* Weekday headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
          {WEEKDAYS.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, padding: "3px 0" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
          {/* Leading empty cells */}
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`s${i}`} style={{ minHeight: 58, borderRadius: 8 }} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const entry = dayMap.get(dateStr);
            const hasValue = !!entry && (entry.recurring > 0 || entry.pt > 0);
            const isPast = isCurrentMonth && dateStr < todayStr;
            const isToday = isCurrentMonth && dateStr === todayStr;

            return (
              <div
                key={day}
                style={{
                  minHeight: 58,
                  background: hasValue ? "#1A1A24" : "#0D0D12",
                  border: `1px solid ${isToday ? "rgba(0,229,160,0.35)" : hasValue ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)"}`,
                  borderRadius: 8,
                  padding: "5px 5px 4px",
                  display: "flex",
                  flexDirection: "column",
                  opacity: isPast ? 0.45 : 1,
                }}
              >
                <span style={{ fontSize: 10, color: isToday ? "#00E5A0" : "rgba(255,255,255,0.3)", marginBottom: 3 }}>
                  {day}
                </span>
                {entry?.recurring ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#00E5A0", lineHeight: 1.3 }}>
                    {eur(entry.recurring)}
                  </span>
                ) : null}
                {entry?.pt ? (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#A78BFA", marginTop: 1, lineHeight: 1.3 }}>
                    {eur(entry.pt)}
                  </span>
                ) : null}
              </div>
            );
          })}

          {/* Trailing empty cells */}
          {Array.from({ length: trailingCells }).map((_, i) => (
            <div key={`e${i}`} style={{ minHeight: 58, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
