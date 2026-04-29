// src/components/sparkline.tsx
"use client";

interface SparklineProps {
  data: number[];
  accent?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, accent = "#00E5A0", width = 320, height = 56 }: SparklineProps) {
  // Need at least 2 points for a line
  const pts = data.length >= 2 ? data : data.length === 1 ? [data[0] * 0.9, data[0]] : [0, 0];

  const n = pts.length;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;

  const points: [number, number][] = pts.map((v, i) => {
    const x = (i / (n - 1)) * width;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return [x, y];
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L ${width} ${height} L 0 ${height} Z`;

  const lastPt = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height, display: "block" }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkfill)" />
      <path d={linePath} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3.5" fill={accent} stroke="#0F0F14" strokeWidth="2" />
    </svg>
  );
}
