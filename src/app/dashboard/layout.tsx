"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { Nav } from "@/components/nav";
import { useAuth } from "@/hooks/use-auth";
import { LoaderIcon } from "@/components/icons";

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
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <Nav role={role} onRefresh={handleRefresh} onLogout={logout} lastFetch={lastFetch} />
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">{children}</div>
          <div className="mt-6 text-center text-zinc-700 text-xs">
            Yogo Booking API · Next.js · v2.0 · {role}
          </div>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}
