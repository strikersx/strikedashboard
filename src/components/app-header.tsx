// src/components/app-header.tsx
"use client";

import { TrophyIcon, RefreshIcon } from "./icons";
import type { Role } from "@/lib/constants";

interface AppHeaderProps {
  role: Role;
  onRefresh: () => void;
  onLogout: () => void;
  lastFetch: Date | null;
}

export function AppHeader({ role, onRefresh, onLogout, lastFetch }: AppHeaderProps) {
  const isAdmin = role === "admin";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px 12px",
        background: "linear-gradient(180deg, #07070a 0%, #07070a 70%, rgba(7,7,10,0) 100%)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Logo — color:#0a0a0a on container so SVG currentColor is dark */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: "linear-gradient(140deg, #00E5A0, rgba(0,229,160,0.8) 60%, rgba(0,229,160,0.55))",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          boxShadow: "0 4px 16px rgba(0,229,160,0.35)",
          color: "#0a0a0a",
        }}
      >
        <TrophyIcon className="w-5 h-5" />
      </div>

      {/* Title + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="head" style={{ fontSize: 16, lineHeight: 1, marginBottom: 3, color: "#fff" }}>
          STRIKER&apos;S HOUSE
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6 }}>
          <span>Carcavelos</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <button
            onClick={onLogout}
            style={{
              background: "transparent",
              border: "none",
              color: "#00E5A0",
              padding: 0,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
            className="tap"
          >
            {isAdmin ? "Admin" : "Vendas"} ▾
          </button>
        </div>
      </div>

      {/* Last fetch time */}
      {lastFetch && (
        <span className="mono hidden md:block" style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
          {lastFetch.toLocaleTimeString("pt-PT")}
        </span>
      )}

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "#15151C",
          border: "1px solid rgba(255,255,255,0.06)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
        }}
        className="tap"
      >
        <RefreshIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
