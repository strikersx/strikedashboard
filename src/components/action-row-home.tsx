// src/components/action-row-home.tsx
"use client";

interface ActionRowHomeProps {
  count: number;
  label: string;
  detail: string;
  cta: string;
  tone: string;       // hex colour
  onClick?: () => void;
  onCta?: () => void;
}

export function ActionRowHome({ count, label, detail, cta, tone, onClick, onCta }: ActionRowHomeProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#0F0F14",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        overflow: "hidden",
      }}
      className="tap"
    >
      {/* Left stripe */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: tone,
        }}
      />

      {/* Count badge */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          flexShrink: 0,
          background: `${tone}1a`,
          color: tone,
          display: "grid",
          placeItems: "center",
        }}
      >
        <span className="num" style={{ fontSize: 18, color: tone }}>{count}</span>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.25 }}>{label}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2, lineHeight: 1.3 }}>{detail}</div>
      </div>

      {/* CTA button */}
      <button
        onClick={(e) => { e.stopPropagation(); onCta?.(); }}
        style={{
          flexShrink: 0,
          padding: "7px 10px",
          borderRadius: 8,
          background: tone,
          border: "none",
          color: "#0a0a0a",
          fontSize: 10.5,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
        className="tap"
      >
        {cta}
      </button>
    </div>
  );
}
