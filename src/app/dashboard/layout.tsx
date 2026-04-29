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
