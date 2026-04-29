// src/components/live-status.tsx
"use client";

interface LiveStatusProps {
  lastFetch: Date | null;
}

export function LiveStatus({ lastFetch }: LiveStatusProps) {
  const time = lastFetch ? lastFetch.toLocaleTimeString("pt-PT") : "—";
  return (
    <div
      style={{
        margin: "0 18px 10px",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderRadius: 12,
        background: "#0F0F14",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Pulsing dot */}
      <span style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
        <span
          className="pulse-dot"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "#00E5A0",
            color: "#00E5A0",
          }}
        />
      </span>
      <span
        className="head"
        style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", letterSpacing: "0.04em" }}
      >
        LIVE
      </span>
      <span
        className="mono"
        style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "right" }}
      >
        última act. {time}
      </span>
    </div>
  );
}
