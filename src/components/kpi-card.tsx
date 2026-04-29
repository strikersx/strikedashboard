// src/components/kpi-card.tsx
"use client";

import { TrendChip, type TrendDir } from "./trend-chip";

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  tone: string;        // hex colour, e.g. "#00E5A0"
  trendDir: TrendDir;
  trendValue: string;  // e.g. "+4", "11%"
  onClick?: () => void;
  density?: "normal" | "compact";
}

export function KPICard({ icon, label, value, sub, tone, trendDir, trendValue, onClick, density = "normal" }: KPICardProps) {
  const pad = density === "compact" ? 12 : 14;
  const numSize = density === "compact" ? 32 : 36;
  const minHeight = density === "compact" ? 116 : 130;

  return (
    <button
      onClick={onClick}
      style={{
        background: "#0F0F14",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: pad,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 10,
        cursor: onClick ? "pointer" : "default",
        textAlign: "left",
        color: "#fff",
        fontFamily: "inherit",
        position: "relative",
        overflow: "hidden",
        minHeight,
        width: "100%",
      }}
      className="tap"
    >
      {/* Corner glow */}
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: tone,
          opacity: 0.07,
          filter: "blur(8px)",
          pointerEvents: "none",
        }}
      />

      {/* Top row: icon box (color:tone so SVG currentColor inherits) + trend chip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: `${tone}22`,
            display: "grid",
            placeItems: "center",
            color: tone,
          }}
        >
          {icon}
        </div>
        <TrendChip dir={trendDir} value={trendValue} />
      </div>

      {/* Value + label */}
      <div>
        <div className="num" style={{ fontSize: numSize, color: "#fff", marginBottom: 4 }}>
          {value}
        </div>
        <div
          className="head"
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.72)",
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>{sub}</div>
      </div>
    </button>
  );
}
