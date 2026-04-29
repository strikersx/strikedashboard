// src/components/trend-chip.tsx
"use client";

export type TrendDir = "up" | "down" | "flat";

interface TrendChipProps {
  dir: TrendDir;
  value: string;
}

const CONFIG = {
  up:   { bg: "rgba(166,226,46,0.12)", fg: "#A6E22E", arrow: "▲" },
  down: { bg: "rgba(255,61,46,0.12)",  fg: "#FF6B5E", arrow: "▼" },
  flat: { bg: "rgba(255,255,255,0.06)", fg: "rgba(255,255,255,0.4)", arrow: "–" },
};

export function TrendChip({ dir, value }: TrendChipProps) {
  const c = CONFIG[dir];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: "2px 6px 2px 4px",
        borderRadius: 5,
        background: c.bg,
        color: c.fg,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 9 }}>{c.arrow}</span>
      {value}
    </span>
  );
}
