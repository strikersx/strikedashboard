"use client";
import { isToday, getToday } from "@/lib/utils";
import { CalendarIcon, ClockIcon } from "./icons";
import { Pill } from "./pill";

interface ClassItem {
  id: number; date: string; start_time: string; end_time: string;
  signup_count?: number; checked_in_count?: number; waiting_list_count?: number;
  urban_sports_club_signup_count?: number; classpass_com_signup_count?: number; bruce_app_signup_count?: number;
  class_type?: { name?: string }; teachers?: { first_name?: string; last_name?: string }[]; room?: { name?: string };
}

interface ClassListProps { classes: ClassItem[]; mode?: "trial" | "visitors"; empty?: string; }

export function ClassList({ classes, mode = "trial", empty = "Sem aulas" }: ClassListProps) {
  if (!classes || classes.length === 0) return <div className="py-12 text-center text-zinc-500">{empty}</div>;
  const byDate: Record<string, ClassItem[]> = {};
  classes.forEach((c) => { const d = c.date || "unknown"; if (!byDate[d]) byDate[d] = []; byDate[d].push(c); });
  const dateLabel = (date: string) => {
    if (date === "unknown") return date;
    const dateObj = new Date(date);
    const formatted = dateObj.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
    return isToday(date) ? `HOJE · ${formatted}` : formatted;
  };
  return (
    <div className="space-y-5">
      {Object.entries(byDate).map(([date, list]) => (
        <div key={date}>
          <h3 className={`text-sm mb-2 font-semibold uppercase tracking-wide flex items-center gap-2 ${isToday(date) ? "text-emerald-400" : "text-zinc-400"}`}>
            <CalendarIcon /> {dateLabel(date)}
          </h3>
          <div className="space-y-2">
            {list.map((c) => {
              const visitorCount = (c.urban_sports_club_signup_count || 0) + (c.classpass_com_signup_count || 0) + (c.bruce_app_signup_count || 0);
              const newCount = mode === "trial" ? (c.signup_count || 0) : visitorCount;
              const borderClr = mode === "trial" ? "border-emerald-500" : "border-blue-500";
              const textClr = mode === "trial" ? "text-emerald-400" : "text-blue-400";
              return (
                <div key={c.id} className={`bg-black/40 rounded-lg p-3 border-l-4 ${borderClr}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2">{c.class_type?.name || "Aula"}<span className={`text-sm font-bold ${textClr}`}>+{newCount}</span></div>
                      <div className="text-xs text-zinc-500 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><ClockIcon />{(c.start_time || "").slice(0, 5)} — {(c.end_time || "").slice(0, 5)}</span>
                        {c.teachers?.[0]?.first_name && <span>· {c.teachers[0].first_name} {c.teachers[0].last_name || ""}</span>}
                        {c.room?.name && <span>{c.room.name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs flex-wrap justify-end">
                      {(c.signup_count || 0) > 0 && <Pill color="blue">{c.signup_count} insc.</Pill>}
                      {(c.checked_in_count || 0) > 0 && <Pill color="emerald">{c.checked_in_count} check-in</Pill>}
                      {(c.urban_sports_club_signup_count || 0) > 0 && <Pill color="purple">USC {c.urban_sports_club_signup_count}</Pill>}
                      {(c.classpass_com_signup_count || 0) > 0 && <Pill color="pink">CP {c.classpass_com_signup_count}</Pill>}
                      {(c.bruce_app_signup_count || 0) > 0 && <Pill color="cyan">Bruce {c.bruce_app_signup_count}</Pill>}
                      {(c.waiting_list_count || 0) > 0 && <Pill color="amber">+{c.waiting_list_count} espera</Pill>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
