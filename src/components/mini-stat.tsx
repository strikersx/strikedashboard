interface MiniStatProps { label: string; value: string | number; color?: "white" | "emerald" | "purple" | "pink" | "cyan" | "blue"; }

const TEXT_COLORS = { white: "text-white", emerald: "text-tone-electric", purple: "text-tone-magenta", pink: "text-tone-magenta", cyan: "text-tone-mint", blue: "text-tone-blue" };

export function MiniStat({ label, value, color = "white" }: MiniStatProps) {
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-2.5 sm:p-3">
      <div className="text-muted-strong text-[10px] font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className={`num text-xl xl:text-2xl font-bold ${TEXT_COLORS[color]}`}>{value}</div>
    </div>
  );
}
