// src/components/bottom-tab-bar.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { HomeIcon, FunnelIcon, FlameIcon, GridIcon, UserPlusIcon } from "./icons";
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
  { id: "leads",  href: "/dashboard/leads",         label: "Leads",  icon: <UserPlusIcon className="w-5 h-5" /> },
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
