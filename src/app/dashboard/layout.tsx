"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { Nav } from "@/components/nav";
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
      <div className="min-h-screen flex items-center justify-center">
        <LoaderIcon />
      </div>
    );
  }

  if (!role) return null;

  return (
    <DashboardContext.Provider value={{ refreshKey, lastFetch, setLastFetch }}>
      <div className="p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <Nav role={role} onRefresh={handleRefresh} onLogout={logout} lastFetch={lastFetch} />
          <div className="bg-surface border border-border-subtle rounded-2xl p-3 sm:p-4 md:p-6 pb-20 md:pb-0">{children}</div>
          <div className="mt-6 text-center text-muted text-xs">
            Yogo Booking API · Next.js · v2.0 · {role}
          </div>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}
