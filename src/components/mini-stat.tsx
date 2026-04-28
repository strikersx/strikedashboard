interface MiniStatProps { label: string; value: string | number; color?: "white" | "emerald" | "purple" | "pink" | "cyan" | "blue"; }

const TEXT_COLORS = { white: "text-white", emerald: "text-emerald-400", purple: "text-purple-400", pink: "text-pink-400", cyan: "text-cyan-400", blue: "text-blue-400" };

export function MiniStat({ label, value, color = "white" }: MiniStatProps) {
  return (
    <div className="bg-black/40 rounded-lg p-3">
      <div className="text-zinc-500 text-xs mb-1">{label}</div>
      <div className={`text-xl xl:text-2xl font-bold ${TEXT_COLORS[color]}`}>{value}</div>
    </div>
  );
}
