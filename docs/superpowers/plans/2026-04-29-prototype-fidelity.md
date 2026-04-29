# Prototype Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dashboard UI with a pixel-faithful port of the `StrikeDashboard/` prototype — bottom tab bar, exact design tokens, hero card with sparkline, KPI cards with glow+TrendChip, prototype-style action rows, and rebuilt subscribers/trials pages.

**Architecture:** Pure UI layer change — all data-fetching logic (hooks, API calls, derived state) stays unchanged. New shell components (AppHeader, LiveStatus, BottomTabBar) replace the existing Nav. KPICard replaces StatCard on the home page. Subscribers and trials pages get rebuilt UIs using the same fetched data. A new `/dashboard/more` page links to secondary sections.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4 (tokens already in `globals.css`), Google Fonts already loaded in `layout.tsx`, inline SVG icons.

**Note on testing:** This is a pure visual redesign — no business logic changes. There are no unit-testable units. Each task ends with a browser verification checklist instead of test assertions.

**Foundation already done (do NOT redo):**
- ✅ Fonts: Barlow Condensed, Inter, JetBrains Mono in `layout.tsx`
- ✅ CSS classes: `.num`, `.head`, `.mono`, `.tap`, `.pulse-dot`, `.bar-grow`, `.fade-in` in `globals.css`
- ✅ Design tokens: `bg-bg`, `bg-surface`, `bg-surface2`, `text-muted`, `text-muted-strong`, `border-border-subtle`, `border-border-strong`, `text-tone-coral`, `bg-tone-coral`, etc. in `globals.css` @theme

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/app-header.tsx` | **Create** | Sticky header: logo, title, role pill, refresh button |
| `src/components/live-status.tsx` | **Create** | Pulsing LIVE dot + last-fetch timestamp |
| `src/components/bottom-tab-bar.tsx` | **Create** | Fixed 5-tab bottom nav bar |
| `src/components/trend-chip.tsx` | **Create** | Up/down/flat trend indicator chip |
| `src/components/sparkline.tsx` | **Create** | SVG sparkline with gradient fill |
| `src/components/kpi-card.tsx` | **Create** | KPI card with glow, icon box, TrendChip |
| `src/components/action-row-home.tsx` | **Create** | Action row: stripe + count badge + CTA button |
| `src/components/status-pill.tsx` | **Create** | active/risk/failed/expired pill for subscribers |
| `src/components/sub-row.tsx` | **Create** | Subscriber list row with initials avatar |
| `src/components/trial-row.tsx` | **Create** | Trial row with colored left border |
| `src/components/icons.tsx` | **Modify** | Add HomeIcon, FunnelIcon, FlameIcon, GridIcon |
| `src/app/dashboard/layout.tsx` | **Modify** | Full-screen layout with AppHeader + LiveStatus + BottomTabBar |
| `src/app/dashboard/page.tsx` | **Modify** | Rebuild admin/sales home with hero + KPI grid + action rows |
| `src/app/dashboard/subscribers/page.tsx` | **Modify** | Rebuild with summary cards, filter chips, SubRow list |
| `src/app/dashboard/trials/page.tsx` | **Modify** | Rebuild with split stat cards, TrialRow list |
| `src/app/dashboard/more/page.tsx` | **Create** | New "Mais" screen with section links + account |

---

## Task 1: Tab icons

Add the 4 missing icons to `src/components/icons.tsx`.

**Files:**
- Modify: `src/components/icons.tsx`

- [ ] **Step 1: Add HomeIcon, FunnelIcon, FlameIcon, GridIcon**

Append to the end of `src/components/icons.tsx` (before the last line):

```tsx
export function HomeIcon({ className = "w-5 h-5" }: IconProps) { return <SvgIcon d='<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' className={className} />; }
export function FunnelIcon({ className = "w-5 h-5" }: IconProps) { return <SvgIcon d='<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>' className={className} />; }
export function FlameIcon({ className = "w-5 h-5" }: IconProps) { return <SvgIcon d='<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>' className={className} />; }
export function GridIcon({ className = "w-5 h-5" }: IconProps) { return <SvgIcon d='<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' className={className} />; }
export function ChevronIcon({ className = "w-4 h-4" }: IconProps) { return <SvgIcon d='<polyline points="9 18 15 12 9 6"/>' className={className} />; }
```

- [ ] **Step 2: Commit**

```bash
git add src/components/icons.tsx
git commit -m "feat: add HomeIcon, FunnelIcon, FlameIcon, GridIcon, ChevronIcon"
```

---

## Task 2: AppHeader component

**Files:**
- Create: `src/components/app-header.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
      {/* Logo */}
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
        }}
      >
        <TrophyIcon className="w-5 h-5" style={{ color: "#0a0a0a" }} />
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

      {/* Last fetch time (hidden on very small screens, shown md+) */}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/app-header.tsx
git commit -m "feat: add AppHeader component"
```

---

## Task 3: LiveStatus component

**Files:**
- Create: `src/components/live-status.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/live-status.tsx
git commit -m "feat: add LiveStatus component"
```

---

## Task 4: BottomTabBar component

**Files:**
- Create: `src/components/bottom-tab-bar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/bottom-tab-bar.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { HomeIcon, FunnelIcon, UsersIcon, FlameIcon, GridIcon } from "./icons";
import type { Role } from "@/lib/constants";

interface Tab {
  id: string;
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const TABS: Tab[] = [
  { id: "home",   href: "/dashboard",              label: "Início", icon: <HomeIcon className="w-5 h-5" /> },
  { id: "funnel", href: "/dashboard/funnel",        label: "Funil",  icon: <FunnelIcon className="w-5 h-5" /> },
  { id: "subs",   href: "/dashboard/subscribers",   label: "Subs",   icon: <UsersIcon className="w-5 h-5" />, adminOnly: true },
  { id: "leads",  href: "/dashboard/trials",        label: "Leads",  icon: <FlameIcon className="w-5 h-5" /> },
  { id: "more",   href: "/dashboard/more",          label: "Mais",   icon: <GridIcon className="w-5 h-5" />, adminOnly: true },
];

interface BottomTabBarProps {
  role: Role;
}

export function BottomTabBar({ role }: BottomTabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = role === "admin";

  const visibleTabs = isAdmin ? TABS : TABS.filter((t) => !t.adminOnly);

  function isActive(tab: Tab): boolean {
    if (tab.id === "home") return pathname === "/dashboard";
    return pathname.startsWith(tab.href);
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        background: "rgba(7,7,10,0.95)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        padding: "8px 4px 26px",
        display: "flex",
      }}
    >
      {visibleTabs.map((tab) => {
        const active = isActive(tab);
        return (
          <button
            key={tab.id}
            onClick={() => router.push(tab.href)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: active ? "#00E5A0" : "rgba(255,255,255,0.5)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "6px 0",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.02em",
              position: "relative",
              fontFamily: "inherit",
            }}
            className="tap"
          >
            {/* Active indicator bar */}
            {active && (
              <div
                style={{
                  position: "absolute",
                  top: -8,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 28,
                  height: 3,
                  borderRadius: 2,
                  background: "#00E5A0",
                }}
              />
            )}
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bottom-tab-bar.tsx
git commit -m "feat: add BottomTabBar component"
```

---

## Task 5: Dashboard layout — wire shell components

Replace the existing `src/app/dashboard/layout.tsx` with the new full-screen layout.

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Rewrite the layout**

```tsx
// src/app/dashboard/layout.tsx
"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { AppHeader } from "@/components/app-header";
import { LiveStatus } from "@/components/live-status";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { useAuth } from "@/hooks/use-auth";
import { LoaderIcon } from "@/components/icons";
import { clearYogoCache } from "@/hooks/use-yogo";

interface DashboardContextValue {
  refreshKey: number;
  lastFetch: Date | null;
  setLastFetch: (d: Date) => void;
}

const DashboardContext = createContext<DashboardContextValue>({
  refreshKey: 0,
  lastFetch: null,
  setLastFetch: () => {},
});

export function useDashboard() {
  return useContext(DashboardContext);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { role, loading, logout } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const handleRefresh = useCallback(() => {
    clearYogoCache();
    setRefreshKey((k) => k + 1);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <LoaderIcon />
      </div>
    );
  }

  if (!role) return null;

  return (
    <DashboardContext.Provider value={{ refreshKey, lastFetch, setLastFetch }}>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh", background: "#07070a" }}>
        {/* Sticky header */}
        <div style={{ position: "sticky", top: 0, zIndex: 20 }}>
          <AppHeader role={role} onRefresh={handleRefresh} onLogout={logout} lastFetch={lastFetch} />
          <LiveStatus lastFetch={lastFetch} />
        </div>

        {/* Scrollable content — pb-28 clears the fixed tab bar */}
        <main className="scrollbox" style={{ flex: 1, overflowY: "auto", paddingBottom: 112 }}>
          {children}
        </main>

        {/* Fixed bottom tab bar */}
        <BottomTabBar role={role} />
      </div>
    </DashboardContext.Provider>
  );
}
```

- [ ] **Step 2: Run dev server and verify the shell**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`. Verify:
- ✅ Black background (#07070a), no white card wrapping content
- ✅ Header: trophy logo (green gradient), "STRIKER'S HOUSE", "Carcavelos · Admin ▾", refresh button
- ✅ LIVE status pill below header with pulsing dot
- ✅ Bottom tab bar: 5 tabs (Início, Funil, Subs, Leads, Mais)
- ✅ Active tab (Início) has green indicator bar on top and green color
- ✅ Other tabs are muted white
- ✅ Tapping "Admin ▾" calls logout
- ✅ Tab switching navigates correctly

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat: replace Nav with AppHeader + LiveStatus + BottomTabBar"
```

---

## Task 6: TrendChip + Sparkline components

**Files:**
- Create: `src/components/trend-chip.tsx`
- Create: `src/components/sparkline.tsx`

- [ ] **Step 1: Create TrendChip**

```tsx
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
```

- [ ] **Step 2: Create Sparkline**

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/trend-chip.tsx src/components/sparkline.tsx
git commit -m "feat: add TrendChip and Sparkline components"
```

---

## Task 7: KPICard component

**Files:**
- Create: `src/components/kpi-card.tsx`

- [ ] **Step 1: Create KPICard**

```tsx
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

      {/* Top row: icon box + trend chip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: `${tone}22`,
            display: "grid",
            placeItems: "center",
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/kpi-card.tsx
git commit -m "feat: add KPICard component"
```

---

## Task 8: ActionRowHome component

**Files:**
- Create: `src/components/action-row-home.tsx`

- [ ] **Step 1: Create ActionRowHome**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/action-row-home.tsx
git commit -m "feat: add ActionRowHome component"
```

---

## Task 9: Dashboard home page rebuild

Rebuild `src/app/dashboard/page.tsx`. Data-fetching logic is identical — only the JSX render changes.

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add sparkline helper and update imports in page.tsx**

Replace the entire file with:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/app/dashboard/layout";
import { useYogoFetch } from "@/hooks/use-yogo";
import { KPICard } from "@/components/kpi-card";
import { ActionRowHome } from "@/components/action-row-home";
import { Sparkline } from "@/components/sparkline";
import { TrendChip } from "@/components/trend-chip";
import {
  EuroIcon, UsersIcon, TrendIcon, CardIcon,
  ZapIcon, UserPlusIcon, TargetIcon, LoaderIcon,
} from "@/components/icons";
import {
  eur, isToday, isThisWeek, isThisMonth,
  getDashboardRange, getLast30Days, fmtDate,
  getPlan, isPTPlan, isNonActionableLead,
} from "@/lib/utils";
import { ALL_SUB_IDS, RECURRING_SUB_IDS, TRIAL_CLASS_TYPE_ID, TRIAL_CLASS_PASS_ID } from "@/lib/constants";

type Rec = Record<string, unknown>;

const REVENUE_QUERY = `
query revenueReport($input: RevenueReportInput!) {
  revenueReport(input: $input) {
    label startDate endDate
    items { itemType itemId itemCount name totalExVat vat totalInclVat vatPercentage eventStartDate }
  }
}`;

/** Group revenue items by month → array of monthly totals for sparkline */
function buildSparkData(revenueItems: Rec[]): number[] {
  const monthTotals: Record<string, number> = {};
  for (const period of revenueItems) {
    const items = (period.items || []) as Rec[];
    for (const item of items) {
      const date = String(item.eventStartDate || "");
      if (!date) continue;
      const key = date.slice(0, 7); // "2026-01"
      monthTotals[key] = (monthTotals[key] || 0) + Number(item.totalInclVat || 0);
    }
  }
  const months = Object.keys(monthTotals).sort();
  if (months.length === 0) return [];
  // Running cumulative totals for a rising sparkline
  let cum = 0;
  return months.map((m) => { cum += monthTotals[m]; return cum; });
}

export default function DashboardPage() {
  const router = useRouter();
  const { role, isAdmin } = useAuth();
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchYogo, fetchReport, fetchGraphQL } = useYogoFetch();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subs, setSubs] = useState<Rec[]>([]);
  const [churn, setChurn] = useState<Rec[]>([]);
  const [failed, setFailed] = useState<Rec[]>([]);
  const [revenueItems, setRevenueItems] = useState<Rec[]>([]);
  const [leads, setLeads] = useState<Rec[]>([]);
  const [trialNoConv, setTrialNoConv] = useState<Rec[]>([]);
  const [trialAttended, setTrialAttended] = useState<Rec[]>([]);
  const [trialClasses, setTrialClasses] = useState<Rec[]>([]);
  const [allClasses, setAllClasses] = useState<Rec[]>([]);

  const classesUrl = useCallback((trialOnly: boolean) => {
    const { startDate, endDate } = getDashboardRange();
    const params = new URLSearchParams();
    params.set("startDate", startDate);
    params.set("endDate", endDate);
    for (const p of ["class_type","teachers","room","room.branch","signup_count","checked_in_count","waiting_list_count","waiting_list_max","livestream_signup_count","classpass_com_signup_count","bruce_app_signup_count","urban_sports_club_signup_count"]) {
      params.append("populate[]", p);
    }
    params.append("sort[]", "date ASC");
    params.append("sort[]", "start_time ASC");
    if (trialOnly) params.append("class_type[]", String(TRIAL_CLASS_TYPE_ID));
    return `classes?${params.toString()}`;
  }, []);

  const sixMonthsAgo = useCallback(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return fmtDate(d);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { startDate: last30Start, endDate: last30End } = getLast30Days();
        const today = fmtDate(new Date());
        const sixMAgo = sixMonthsAgo();

        const commonPromises = {
          leads: fetchReport("reports/customers", { filters: [{ type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false }, { type: "hasNoClassPass", classPassTypeId: [], onlyActiveClassPasses: false }], returnColumnHeaders: true }),
          trialNoConv: fetchReport("reports/customers", { filters: [{ type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false }, { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false }], returnColumnHeaders: true }),
          trialAttended: fetchReport("reports/customers", { filters: [{ type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false }, { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false }, { type: "numberOfSignups", classTypeId: [TRIAL_CLASS_TYPE_ID], membershipTypeId: [], conditionType: "greaterThanOrEquals", conditionAmount: 1, averagePerTimeUnit: "month", startDate: sixMAgo, endDate: today, includeClassSignups: true, onlyCheckedInClassSignups: true, includeWaitingListSignups: false, includeLivestreamSignups: false, includeZeroSignups: false }], returnColumnHeaders: true }),
          trialClasses: fetchYogo(classesUrl(true)),
          allClasses: fetchYogo(classesUrl(false)),
        };

        const adminPromises = isAdmin ? {
          subs: fetchReport("reports/customers", { filters: [{ type: "hasMembershipOrClassPass", membershipTypeId: ALL_SUB_IDS, classPassTypeId: [], onlyActiveMembershipsOrClassPasses: false }], returnColumnHeaders: true }),
          churn: fetchReport("reports/customers", { filters: [{ type: "numberOfSignups", classTypeId: [], membershipTypeId: [], conditionType: "lessThanOrEquals", conditionAmount: 0, averagePerTimeUnit: "month", startDate: last30Start, endDate: last30End, includeClassSignups: true, onlyCheckedInClassSignups: false, includeWaitingListSignups: false, includeLivestreamSignups: false, includeZeroSignups: false }, { type: "hasMembershipOrClassPass", membershipTypeId: RECURRING_SUB_IDS, classPassTypeId: [], onlyActiveMembershipsOrClassPasses: true }], returnColumnHeaders: true }),
          failed: fetchReport("reports/memberships-list", { status: ["ended"], is_payment_failed: true, has_pending_no_show_fees: false, ended_because: ["payment_failed"] }),
          revenue: fetchGraphQL(REVENUE_QUERY, { input: { periodType: "year", startDate: `${new Date().getFullYear()}-01-01`, endDate: `${new Date().getFullYear()}-12-31`, dateFilterField: "paid", vatFilter: null, canHandleSeparateRefunds: true } }),
        } : {};

        const allKeys = { ...commonPromises, ...adminPromises };
        const entries = Object.entries(allKeys);
        const results = await Promise.all(entries.map(([, p]) => p));
        const data: Record<string, unknown> = {};
        entries.forEach(([k], i) => { data[k] = results[i]; });

        if (cancelled) return;

        setLeads(data.leads as Rec[]);
        setTrialNoConv(data.trialNoConv as Rec[]);
        setTrialAttended(data.trialAttended as Rec[]);
        const extractClasses = (d: unknown): Rec[] => Array.isArray(d) ? d : (d && typeof d === "object" && "classes" in d) ? (d as { classes: Rec[] }).classes : [];
        setTrialClasses(extractClasses(data.trialClasses));
        setAllClasses(extractClasses(data.allClasses));

        if (isAdmin) {
          setSubs(data.subs as Rec[]);
          setChurn(data.churn as Rec[]);
          setFailed(data.failed as Rec[]);
          const revData = data.revenue as { data?: { revenueReport?: Rec | Rec[] } };
          const report = revData?.data?.revenueReport;
          const reportItems = Array.isArray(report) ? report : report ? [report] : [];
          setRevenueItems(reportItems as Rec[]);
        }

        setLastFetch(new Date());
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey, isAdmin, fetchYogo, fetchReport, fetchGraphQL, classesUrl, sixMonthsAgo, setLastFetch]);

  /* ─── Derived state ─── */
  const ptCount = subs.filter((c) => isPTPlan(getPlan(String(c.has_membership_membership_description || "")))).length;
  const groupSubsCount = subs.length - ptCount;
  const churnPct = subs.length > 0 ? Math.round((churn.length / subs.length) * 100) : 0;
  const revenueTotal = revenueItems.reduce((sum, period) => {
    const items = (period.items || []) as Rec[];
    return sum + items.reduce((s, it) => s + (Number(it.totalInclVat) || 0), 0);
  }, 0);
  const monthsElapsed = new Date().getMonth() + 1;
  const avgMonth = monthsElapsed > 0 ? Math.round(revenueTotal / monthsElapsed) : 0;
  const sparkData = buildSparkData(revenueItems);

  const leadsActionable = leads.filter((l) => !isNonActionableLead(l as { email?: string }));
  const attendedIds = new Set(trialAttended.map((r) => String(r.id || r.customer_id)));
  const trialEnriched = trialNoConv.map((t) => ({ ...t, attended: attendedIds.has(String(t.id || t.customer_id)) })) as (Rec & { attended: boolean })[];
  const trialAttendedCount = trialEnriched.filter((t) => t.attended).length;
  const trialNoShowCount = trialEnriched.filter((t) => !t.attended).length;

  const trialClassesArr = Array.isArray(trialClasses) ? trialClasses : [];
  const trialWithSignups = trialClassesArr.filter((c) => Number(c.signup_count) > 0);
  const newTrialToday = trialWithSignups.filter((c) => isToday(String(c.date))).reduce((s, c) => s + Number(c.signup_count), 0);
  const newTrialWeek = trialWithSignups.filter((c) => isThisWeek(String(c.date))).reduce((s, c) => s + Number(c.signup_count), 0);
  const newTrialMonth = trialWithSignups.filter((c) => isThisMonth(String(c.date))).reduce((s, c) => s + Number(c.signup_count), 0);

  const allClassesArr = Array.isArray(allClasses) ? allClasses : [];
  const visitorSum = (c: Rec) => Number(c.urban_sports_club_signup_count || 0) + Number(c.classpass_com_signup_count || 0) + Number(c.bruce_app_signup_count || 0);
  const withVisitors = allClassesArr.filter((c) => visitorSum(c) > 0);
  const visitorsToday = withVisitors.filter((c) => isToday(String(c.date))).reduce((s, c) => s + visitorSum(c), 0);
  const visitorsWeek = withVisitors.filter((c) => isThisWeek(String(c.date))).reduce((s, c) => s + visitorSum(c), 0);
  const visitorsMonth = withVisitors.filter((c) => isThisMonth(String(c.date))).reduce((s, c) => s + visitorSum(c), 0);

  /* ─── Loading / Error ─── */
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <LoaderIcon />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "80px 18px" }}>
        <div style={{ color: "#FF3D2E", marginBottom: 8 }}>Erro ao carregar dados</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{error}</div>
      </div>
    );
  }

  /* ─── ADMIN VIEW ─── */
  if (isAdmin) {
    const actions = [
      failed.length > 0 && { count: failed.length, label: "pagamentos falhados", detail: "Cartões expirados ou recusados — recuperar receita ou cancelar", cta: "Contactar", tone: "#FF3D2E", href: "/dashboard/failed" },
      churn.length > 0 && { count: churn.length, label: "membros em risco de churn", detail: `0 aulas nos últimos 30 dias — risco de cancelamento`, cta: "Rever", tone: "#FFB627", href: "/dashboard/churn" },
      trialAttendedCount > 0 && { count: trialAttendedCount, label: "trials que foram à aula", detail: "Lead quente — fechar venda nas próximas 24-48h", cta: "Follow-up", tone: "#FF2E88", href: "/dashboard/trials" },
      trialNoShowCount > 0 && { count: trialNoShowCount, label: "trials que faltaram", detail: "Pode ser no-show — confirmar e reagendar", cta: "Reagendar", tone: "#00E5A0", href: "/dashboard/trials" },
      leadsActionable.length > 0 && { count: leadsActionable.length, label: "leads sem contacto há 7d", detail: "Reactivar conversação antes que esfriem", cta: "WhatsApp", tone: "#A6E22E", href: "/dashboard/leads" },
    ].filter(Boolean) as { count: number; label: string; detail: string; cta: string; tone: string; href: string }[];

    return (
      <div style={{ paddingBottom: 32 }}>
        {/* ── Hero: Receita YTD ── */}
        <div style={{ padding: "4px 18px 14px" }}>
          <div style={{
            background: "linear-gradient(135deg, #0F0F14 0%, #12121A 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 18,
            padding: 18,
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Glow */}
            <div style={{
              position: "absolute", right: -20, top: -20, width: 140, height: 140,
              background: "radial-gradient(circle, rgba(0,229,160,0.2) 0%, transparent 70%)",
              borderRadius: "50%",
            }} />
            <div style={{ position: "relative" }}>
              <div className="head" style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", marginBottom: 8 }}>
                Receita YTD
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 10 }}>
                <div className="num" style={{ fontSize: 56, color: "#fff", lineHeight: 0.85 }}>
                  {eur(revenueTotal)}
                </div>
                <TrendChip dir="up" value={`Média ${eur(avgMonth)}/mês`} />
              </div>
              <Sparkline data={sparkData} accent="#00E5A0" height={56} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                  Jan {new Date().getFullYear().toString().slice(2)}
                </span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Média {eur(avgMonth)}/mês</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Hoje</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI grid ── */}
        <SectionHead title="Indicadores" action="ver todos" onAction={() => router.push("/dashboard/more")} />
        <div style={{ padding: "0 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <KPICard icon={<UsersIcon className="w-3.5 h-3.5" style={{ color: "#3D7DFF" }} />} label="Subscrições activas" value={subs.length} sub={`${groupSubsCount} grupo · ${ptCount} PT`} tone="#3D7DFF" trendDir="up" trendValue={`+${subs.length}`} onClick={() => router.push("/dashboard/subscribers")} />
          <KPICard icon={<TrendIcon className="w-3.5 h-3.5" style={{ color: "#FFB627" }} />} label="Churn (30d)" value={churn.length} sub={`${churnPct}% — sem aulas em 30d`} tone="#FFB627" trendDir={churnPct > 10 ? "down" : "flat"} trendValue={`${churnPct}%`} onClick={() => router.push("/dashboard/churn")} />
          <KPICard icon={<CardIcon className="w-3.5 h-3.5" style={{ color: "#FF3D2E" }} />} label="Pagamentos falhados" value={failed.length} sub="Memberships ended" tone="#FF3D2E" trendDir={failed.length > 0 ? "down" : "flat"} trendValue={`${failed.length}`} onClick={() => router.push("/dashboard/failed")} />
          <KPICard icon={<UserPlusIcon className="w-3.5 h-3.5" style={{ color: "#A6E22E" }} />} label="Leads" value={leadsActionable.length} sub={`${leads.length - leadsActionable.length} não accionáveis`} tone="#A6E22E" trendDir="up" trendValue={`+${leadsActionable.length}`} onClick={() => router.push("/dashboard/leads")} />
          <KPICard icon={<TargetIcon className="w-3.5 h-3.5" style={{ color: "#FF2E88" }} />} label="Trials s/ conv." value={trialEnriched.length} sub={`${trialAttendedCount} foram · ${trialNoShowCount} faltaram`} tone="#FF2E88" trendDir={trialEnriched.length > 0 ? "down" : "flat"} trendValue={`${trialEnriched.length}`} onClick={() => router.push("/dashboard/trials")} />
          <KPICard icon={<ZapIcon className="w-3.5 h-3.5" style={{ color: "#00E5A0" }} />} label="Novos trials" value={newTrialToday} sub={`Semana ${newTrialWeek} · Mês ${newTrialMonth}`} tone="#00E5A0" trendDir={newTrialToday > 0 ? "up" : "flat"} trendValue={`${newTrialMonth} mês`} onClick={() => router.push("/dashboard/classes")} />
          <KPICard icon={<UsersIcon className="w-3.5 h-3.5" style={{ color: "#3D7DFF" }} />} label="Visitantes" value={visitorsToday} sub={`Semana ${visitorsWeek} · Mês ${visitorsMonth}`} tone="#3D7DFF" trendDir={visitorsToday > 0 ? "up" : "flat"} trendValue={`${visitorsMonth} mês`} onClick={() => router.push("/dashboard/classes")} />
        </div>

        {/* ── Action rows ── */}
        <SectionHead title="Acções recomendadas" count={actions.length} />
        <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          {actions.length === 0 && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
              Tudo em ordem — sem acções pendentes.
            </div>
          )}
          {actions.map((a) => (
            <ActionRowHome
              key={a.href + a.label}
              count={a.count}
              label={a.label}
              detail={a.detail}
              cta={a.cta}
              tone={a.tone}
              onClick={() => router.push(a.href)}
              onCta={() => router.push(a.href)}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ─── SALES VIEW ─── */
  return (
    <div style={{ paddingBottom: 32 }}>
      <SectionHead title="Funil de Conversão" />
      <div style={{ padding: "0 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <KPICard icon={<UserPlusIcon className="w-3.5 h-3.5" style={{ color: "#A6E22E" }} />} label="Leads" value={leadsActionable.length} sub={`${leads.length - leadsActionable.length} filtrados`} tone="#A6E22E" trendDir="up" trendValue={`+${leadsActionable.length}`} onClick={() => router.push("/dashboard/leads")} />
        <KPICard icon={<TargetIcon className="w-3.5 h-3.5" style={{ color: "#FF2E88" }} />} label="Trials s/ conv." value={trialEnriched.length} sub={`${trialAttendedCount} foram · ${trialNoShowCount} faltaram`} tone="#FF2E88" trendDir="down" trendValue={`${trialEnriched.length}`} onClick={() => router.push("/dashboard/trials")} />
        <KPICard icon={<ZapIcon className="w-3.5 h-3.5" style={{ color: "#00E5A0" }} />} label="Novos trials" value={newTrialToday} sub={`Semana ${newTrialWeek} · Mês ${newTrialMonth}`} tone="#00E5A0" trendDir={newTrialToday > 0 ? "up" : "flat"} trendValue={`${newTrialMonth} mês`} onClick={() => router.push("/dashboard/classes")} />
        <KPICard icon={<UsersIcon className="w-3.5 h-3.5" style={{ color: "#3D7DFF" }} />} label="Visitantes" value={visitorsToday} sub={`Semana ${visitorsWeek} · Mês ${visitorsMonth}`} tone="#3D7DFF" trendDir={visitorsToday > 0 ? "up" : "flat"} trendValue={`${visitorsMonth} mês`} onClick={() => router.push("/dashboard/classes")} />
      </div>

      <SectionHead title="Acções recomendadas" count={trialAttendedCount + trialNoShowCount + leadsActionable.length} />
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        {trialAttendedCount > 0 && <ActionRowHome count={trialAttendedCount} label="trials que foram à aula" detail="Lead quente — fechar venda nas próximas 24-48h" cta="Follow-up" tone="#FF2E88" onClick={() => router.push("/dashboard/trials")} onCta={() => router.push("/dashboard/trials")} />}
        {trialNoShowCount > 0 && <ActionRowHome count={trialNoShowCount} label="trials que faltaram" detail="Confirmar e reagendar" cta="Reagendar" tone="#00E5A0" onClick={() => router.push("/dashboard/trials")} onCta={() => router.push("/dashboard/trials")} />}
        {leadsActionable.length > 0 && <ActionRowHome count={leadsActionable.length} label="leads sem contacto há 7d" detail="Reactivar conversação antes que esfriem" cta="WhatsApp" tone="#A6E22E" onClick={() => router.push("/dashboard/leads")} onCta={() => router.push("/dashboard/leads")} />}
      </div>
    </div>
  );
}

/* ── SectionHead ── */
function SectionHead({ title, count, action, onAction }: { title: string; count?: number; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "18px 18px 10px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>{title}</h3>
        {count != null && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{count}</span>}
      </div>
      {action && (
        <button onClick={onAction} style={{ background: "transparent", border: "none", color: "#00E5A0", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: 0, fontFamily: "inherit" }} className="tap">
          {action} ›
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify home page in browser**

```bash
npm run dev
```

Open `/dashboard`. Verify:
- ✅ Hero card with large revenue number, green trend chip, sparkline with gradient
- ✅ KPI grid 2 columns, each card with: icon box, glow, TrendChip, large number, label, sub-text
- ✅ Action rows: left stripe, count badge, label, detail text, coloured CTA button
- ✅ Admin role shows all 7 KPI cards + action rows
- ✅ Sales role shows 4 KPI cards + sales-focused actions

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: rebuild dashboard home with hero card, KPI grid, action rows"
```

---

## Task 10: StatusPill + SubRow + Subscribers page

**Files:**
- Create: `src/components/status-pill.tsx`
- Create: `src/components/sub-row.tsx`
- Modify: `src/app/dashboard/subscribers/page.tsx`

- [ ] **Step 1: Create StatusPill**

```tsx
// src/components/status-pill.tsx
"use client";

export type SubStatus = "active" | "risk" | "failed" | "expired";

interface StatusPillProps {
  status: SubStatus;
  daysUntilRenewal?: number;
}

const CFG: Record<SubStatus, { bg: string; fg: string; label: (d?: number) => string }> = {
  active:  { bg: "rgba(0,229,160,0.14)",  fg: "#00E5A0", label: (d) => d != null && d >= 0 ? `renova em ${d}d` : "activo" },
  risk:    { bg: "rgba(255,182,39,0.14)", fg: "#FFB627", label: (d) => d != null ? `risco · ${d}d` : "risco" },
  failed:  { bg: "rgba(255,61,46,0.14)",  fg: "#FF6B5E", label: (d) => d != null ? `falha · ${Math.abs(d)}d` : "falha" },
  expired: { bg: "rgba(255,61,46,0.18)",  fg: "#FF6B5E", label: (d) => d != null ? `venceu há ${Math.abs(d)}d` : "vencido" },
};

export function StatusPill({ status, daysUntilRenewal }: StatusPillProps) {
  const cfg = CFG[status] ?? CFG.active;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 8px",
        borderRadius: 6,
        background: cfg.bg,
        color: cfg.fg,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.fg, flexShrink: 0 }} />
      {cfg.label(daysUntilRenewal)}
    </span>
  );
}
```

- [ ] **Step 2: Create SubRow**

```tsx
// src/components/sub-row.tsx
"use client";

import { StatusPill, type SubStatus } from "./status-pill";

interface SubRowProps {
  name: string;
  plan: string;
  detail: string;        // e.g. "6/12 aulas"
  status: SubStatus;
  daysUntilRenewal?: number;
  onClick?: () => void;
}

export function SubRow({ name, plan, detail, status, daysUntilRenewal, onClick }: SubRowProps) {
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
        borderRadius: 12,
        padding: "11px 12px",
        display: "flex",
        alignItems: "center",
        gap: 11,
        cursor: onClick ? "pointer" : "default",
      }}
      className="tap"
    >
      {/* Avatar */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "linear-gradient(135deg, #1f1f28 0%, #15151c 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "0.02em",
        }}
      >
        {initials}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{name}</div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plan}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ flexShrink: 0 }}>{detail}</span>
        </div>
      </div>

      <StatusPill status={status} daysUntilRenewal={daysUntilRenewal} />
    </div>
  );
}
```

- [ ] **Step 3: Read the full subscribers page to understand current data shape**

Read `src/app/dashboard/subscribers/page.tsx` lines 80-200 to see how `planGroups` and `totalRevenue` are derived, then rebuild the render section only.

- [ ] **Step 4: Replace the render section of subscribers/page.tsx**

The data-fetching `load()` function and all interfaces stay unchanged. Replace everything from the `return (` statement onward:

```tsx
  // (keep all existing code above the return statement)
  // Replace from here:

  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "risk" | "failed">("all");

  // ... after loading/error guards, add filter logic above the return:

  // Build flat list with status derived from paid_until
  const today = new Date().toISOString().slice(0, 10);
  const allCustomers = planGroups.flatMap((g) =>
    g.customers.map((c) => {
      const paidUntil = c.paid_until ?? "";
      const daysLeft = paidUntil
        ? Math.round((new Date(paidUntil).getTime() - Date.now()) / 86400000)
        : 0;
      let status: "active" | "risk" | "failed" | "expired" = "active";
      if (!paidUntil || paidUntil < today) status = "expired";
      else if (daysLeft <= 7) status = "risk";
      return { ...c, plan: g.plan, daysLeft, status, paidUntil };
    })
  );

  const filtered =
    activeFilter === "all" ? allCustomers :
    activeFilter === "failed" ? allCustomers.filter((c) => c.status === "failed" || c.status === "expired") :
    allCustomers.filter((c) => c.status === activeFilter);

  const filters = [
    { id: "all" as const,    label: "Todos",   count: allCustomers.length },
    { id: "active" as const, label: "Activos", count: allCustomers.filter((c) => c.status === "active").length },
    { id: "risk" as const,   label: "Risco",   count: allCustomers.filter((c) => c.status === "risk").length },
    { id: "failed" as const, label: "Falhas",  count: allCustomers.filter((c) => c.status === "failed" || c.status === "expired").length },
  ];

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Summary cards */}
      <div style={{ padding: "4px 18px 14px", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
        <div style={{ background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14 }}>
          <div className="head" style={{ fontSize: 10, color: "rgba(255,255,255,0.72)", marginBottom: 6 }}>SUBSCRITORES</div>
          <div className="num" style={{ fontSize: 38, color: "#fff" }}>{totalCount}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>activos · todos os planos</div>
        </div>
        <div style={{ background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14 }}>
          <div className="head" style={{ fontSize: 10, color: "rgba(255,255,255,0.72)", marginBottom: 6 }}>MRR ESTIMADO</div>
          <div className="num" style={{ fontSize: 38, color: "#00E5A0" }}>{eur(totalRevenue)}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>por mês · receita activa</div>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ padding: "0 18px 10px", display: "flex", gap: 6 }} className="scrollbox" >
        {filters.map((f) => {
          const isActive = activeFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              style={{
                flexShrink: 0, padding: "7px 12px", borderRadius: 999,
                background: isActive ? "#00E5A0" : "#0F0F14",
                color: isActive ? "#0a0a0a" : "rgba(255,255,255,0.72)",
                border: `1px solid ${isActive ? "#00E5A0" : "rgba(255,255,255,0.06)"}`,
                fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
                cursor: "pointer", fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
              className="tap"
            >
              {f.label}
              <span style={{ fontSize: 10, opacity: 0.7 }}>{f.count}</span>
            </button>
          );
        })}
      </div>

      {/* Subscriber list */}
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((c) => (
          <SubRow
            key={c.id}
            name={`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Sem nome"}
            plan={c.plan}
            detail={c.paidUntil ? `até ${c.paidUntil}` : "—"}
            status={c.status}
            daysUntilRenewal={c.daysLeft}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
            Nenhum subscritor nesta categoria.
          </div>
        )}
      </div>
    </div>
  );
```

Also add at the top of the component function:
```tsx
const [activeFilter, setActiveFilter] = useState<"all" | "active" | "risk" | "failed">("all");
```

And add imports:
```tsx
import { SubRow } from "@/components/sub-row";
import { eur } from "@/lib/utils";
```

- [ ] **Step 5: Verify in browser**

Open `/dashboard/subscribers`. Verify:
- ✅ Two summary cards at top (count + MRR in accent green)
- ✅ Filter chips (Todos/Activos/Risco/Falhas) — active chip fills green
- ✅ Each subscriber row: initials avatar, name, plan, StatusPill
- ✅ Filtering works correctly

- [ ] **Step 6: Commit**

```bash
git add src/components/status-pill.tsx src/components/sub-row.tsx src/app/dashboard/subscribers/page.tsx
git commit -m "feat: rebuild subscribers page with SubRow and StatusPill"
```

---

## Task 11: TrialRow + Trials page

**Files:**
- Create: `src/components/trial-row.tsx`
- Modify: `src/app/dashboard/trials/page.tsx`

- [ ] **Step 1: Create TrialRow**

```tsx
// src/components/trial-row.tsx
"use client";

interface TrialRowProps {
  name: string;
  phone?: string;
  registeredAt?: string;
  attended: boolean;
  onClick?: () => void;
}

export function TrialRow({ name, phone, registeredAt, attended, onClick }: TrialRowProps) {
  const tone = attended ? "#FF2E88" : "#FFB627";
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
      {/* Avatar */}
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

      {/* Info */}
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

      {/* Status badge */}
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
        {attended ? "✓ FOI" : "× FALTOU"}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Replace the render section of trials/page.tsx**

Keep the entire data-fetching `load()` function, interfaces, and useEffect. Replace from the `return (` onward. Also add these imports at the top:

```tsx
import { TrialRow } from "@/components/trial-row";
```

Replace render section:

```tsx
  const went = students.filter((s) => s.attended);
  const noshow = students.filter((s) => !s.attended);
  const [tab, setTab] = useState<"hot" | "cold">("hot");
  const list = tab === "hot" ? went : noshow;

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Split stat cards */}
      <div style={{ padding: "4px 18px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          onClick={() => setTab("hot")}
          style={{
            padding: 14, borderRadius: 14, cursor: "pointer", textAlign: "left",
            background: tab === "hot" ? "rgba(255,46,136,0.08)" : "#0F0F14",
            border: `1px solid ${tab === "hot" ? "#FF2E88" : "rgba(255,255,255,0.06)"}`,
            color: "#fff", fontFamily: "inherit",
          }}
          className="tap"
        >
          <div className="head" style={{ fontSize: 10, color: "#FF2E88", marginBottom: 6 }}>FORAM À AULA</div>
          <div className="num" style={{ fontSize: 38, color: "#fff" }}>{went.length}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4, lineHeight: 1.3 }}>
            Lead quente — fechar venda 24-48h
          </div>
        </button>
        <button
          onClick={() => setTab("cold")}
          style={{
            padding: 14, borderRadius: 14, cursor: "pointer", textAlign: "left",
            background: tab === "cold" ? "rgba(255,182,39,0.08)" : "#0F0F14",
            border: `1px solid ${tab === "cold" ? "#FFB627" : "rgba(255,255,255,0.06)"}`,
            color: "#fff", fontFamily: "inherit",
          }}
          className="tap"
        >
          <div className="head" style={{ fontSize: 10, color: "#FFB627", marginBottom: 6 }}>FALTARAM</div>
          <div className="num" style={{ fontSize: 38, color: "#fff" }}>{noshow.length}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4, lineHeight: 1.3 }}>
            No-show — confirmar e reagendar
          </div>
        </button>
      </div>

      {/* List */}
      <div style={{ padding: "4px 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
        <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>
          {tab === "hot" ? "Foram à aula" : "Faltaram ou agendado"}
        </h3>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{list.length}</span>
      </div>
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((t) => (
          <TrialRow
            key={t.id}
            name={`${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || "Sem nome"}
            phone={t.phone}
            registeredAt={t.createdAt ? new Date(t.createdAt).toLocaleDateString("pt-PT") : undefined}
            attended={t.attended ?? false}
          />
        ))}
        {list.length === 0 && (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
            Nenhum registo nesta categoria.
          </div>
        )}
      </div>

      {/* Trial classes section */}
      {classes.length > 0 && (
        <>
          <div style={{ padding: "18px 18px 10px" }}>
            <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>
              Aulas Experimentais <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{classes.length}</span>
            </h3>
          </div>
          <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
            {classes.map((c) => (
              <div
                key={c.id}
                style={{ background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 12px" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                      {c.date} · {c.start_time?.slice(0, 5)}
                    </div>
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                      {c.class_type?.name ?? "Experimental"}
                      {c.teachers?.[0] && ` · ${c.teachers[0].first_name} ${c.teachers[0].last_name}`}
                    </div>
                  </div>
                  <span className="num" style={{ fontSize: 22, color: "#00E5A0" }}>{c.signup_count}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
```

Add `const [tab, setTab] = useState<"hot" | "cold">("hot");` near top of the component function.

- [ ] **Step 3: Verify in browser**

Open `/dashboard/trials`. Verify:
- ✅ Two top stat cards with pink/amber borders based on active tab
- ✅ Clicking "Foram à aula" / "Faltaram" switches tab
- ✅ Trial rows: colored left border (pink = went, amber = missed), initials avatar, name, phone, date, badge
- ✅ Trial classes section below if any

- [ ] **Step 4: Commit**

```bash
git add src/components/trial-row.tsx src/app/dashboard/trials/page.tsx
git commit -m "feat: rebuild trials page with TrialRow split-tab layout"
```

---

## Task 12: "Mais" page

**Files:**
- Create: `src/app/dashboard/more/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/app/dashboard/more/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ChevronIcon } from "@/components/icons";

interface Section {
  id: string;
  label: string;
  sub: string;
  icon: string;
  href: string;
}

const SECTIONS: Section[] = [
  { id: "revenue",  label: "Faturação",           sub: "Receita e histórico de pagamentos",  icon: "⚡", href: "/dashboard/revenue" },
  { id: "pts",      label: "PTs",                  sub: "Personal trainers e sessões",        icon: "👤", href: "/dashboard/pts" },
  { id: "trials",   label: "Experimentais",        sub: "Trials sem conversão",               icon: "🎫", href: "/dashboard/trials" },
  { id: "churn",    label: "Churn",                sub: "Membros em risco de cancelamento",   icon: "📉", href: "/dashboard/churn" },
  { id: "failed",   label: "Pagamentos falhados",  sub: "Cartões recusados ou expirados",     icon: "💳", href: "/dashboard/failed" },
  { id: "classes",  label: "Visitantes",           sub: "USC, ClassPass, Bruce App",          icon: "✨", href: "/dashboard/classes" },
];

export default function MorePage() {
  const router = useRouter();
  const { role, logout } = useAuth();
  const isAdmin = role === "admin";

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Section links */}
      <div style={{ padding: "4px 18px 10px" }}>
        <h3 className="head" style={{ margin: "14px 0 10px", fontSize: 18, color: "#fff" }}>Outras secções</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SECTIONS.map((s) => (
            <div
              key={s.id}
              onClick={() => router.push(s.href)}
              style={{
                background: "#0F0F14",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
              className="tap"
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  fontSize: 18,
                }}
              >
                {s.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{s.sub}</div>
              </div>
              <ChevronIcon className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Account section */}
      <div style={{ padding: "0 18px" }}>
        <h3 className="head" style={{ margin: "18px 0 10px", fontSize: 18, color: "#fff" }}>Conta</h3>
        <div
          style={{
            background: "#0F0F14",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #00E5A0, rgba(0,229,160,0.6))",
              display: "grid",
              placeItems: "center",
              fontSize: 14,
              fontWeight: 800,
              color: "#0a0a0a",
              flexShrink: 0,
            }}
          >
            SH
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Striker&apos;s House · Carcavelos</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
              {isAdmin ? "Admin" : "Vendas"}
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.72)",
              padding: "8px 12px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
            className="tap"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open `/dashboard/more` (or tap "Mais" tab). Verify:
- ✅ List of 6 section links with emoji icon, label, sub-text, chevron
- ✅ Tapping a link navigates to correct route
- ✅ Account section shows "SH" avatar, role, logout button
- ✅ Logout button calls logout

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/more/page.tsx
git commit -m "feat: add Mais page with section links and account"
```

---

## Task 13: Final verification

- [ ] **Step 1: Build check**

```bash
npm run build
```

Expected: no TypeScript errors, no ESLint errors. Fix any that appear.

- [ ] **Step 2: Full browser walkthrough**

```bash
npm run dev
```

Walk through each tab and verify:

**Início:**
- ✅ Black background, no white card wrapper
- ✅ Sticky header with logo + LIVE pill
- ✅ Hero card: revenue number, sparkline, trend chip
- ✅ KPI grid: 2 columns, glow on each card, TrendChips
- ✅ Action rows: stripe, count badge, label, CTA button

**Funil:**
- ✅ Design tokens applied (bg-bg background, surface cards)
- ✅ No old card wrapper

**Subs:**
- ✅ Summary cards at top
- ✅ Filter chips (pill style, fills green when active)
- ✅ SubRow list with initials avatar + StatusPill

**Leads:**
- ✅ Pink/amber split stat cards at top
- ✅ Tab switching works
- ✅ TrialRow: colored left border, initials, badge

**Mais:**
- ✅ Section list with navigation
- ✅ Account + logout

**Bottom tab bar (all pages):**
- ✅ Active tab indicator bar (28px wide, 3px tall, green)
- ✅ Active tab text green, others muted white
- ✅ Content doesn't get hidden under tab bar (pb-28)
- ✅ Header stays sticky on scroll

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete prototype-fidelity UI — bottom tab bar, KPI cards, hero sparkline"
```
