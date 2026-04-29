"use client";

interface TrendChipProps {
  direction: "up" | "down" | "flat";
  value: string;
}

export function TrendChip({ direction, value }: TrendChipProps) {
  const config = {
    up: {
      bg: "bg-tone-lime/12",
      text: "text-tone-lime",
      icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>,
    },
    down: {
      bg: "bg-tone-coral/12",
      text: "text-[#FF6B5E]",
      icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>,
    },
    flat: {
      bg: "bg-white/6",
      text: "text-white/40",
      icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="12" cy="12" r="2" /></svg>,
    },
  }[direction];

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${config.bg} ${config.text}`}>
      {config.icon}
      {value}
    </span>
  );
}
