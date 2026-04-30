// src/components/trial-row.tsx
"use client";

interface TrialRowProps {
  name: string;
  phone?: string;
  registeredAt?: string;
  attended: boolean | undefined;
  onClick?: () => void;
}

export function TrialRow({ name, phone, registeredAt, attended, onClick }: TrialRowProps) {
  const tone = attended === true ? "#FF2E88" : attended === false ? "#FFB627" : "#9B59B6";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      onClick={onClick}
      style={{
        background: "#0F0F14",
        border: "1px solid rgba(255,255,255,0.06)",
        borderLeft: `3px solid ${tone}`,
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 11,
        cursor: onClick ? "pointer" : "default",
      }}
      className="tap"
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${tone}1a`,
          color: tone,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{name}</div>
        <div
          style={{
            fontSize: 10.5,
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {[phone, registeredAt].filter(Boolean).join(" · ")}
        </div>
      </div>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: tone,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          padding: "3px 7px",
          borderRadius: 5,
          background: `${tone}1a`,
          flexShrink: 0,
        }}
      >
        {attended === true ? "✓ FOI" : attended === false ? "× FALTOU" : "⊗ PASSE"}
      </span>
    </div>
  );
}
