"use client";

import { useState, useEffect, useCallback } from "react";
import type { Role } from "@/lib/constants";

export function useAuth() {
  const [role, setRole] = useState<Role | null>(null);
  const [waEnabled, setWaEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setRole(data?.role ?? null);
        if (typeof data?.waEnabled === "boolean") setWaEnabled(data.waEnabled);
      })
      .catch(() => setRole(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (password: string): Promise<{ role: Role } | { error: string }> => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (res.ok) {
      setRole(data.role);
      return { role: data.role };
    }
    return { error: data.error || "Erro desconhecido" };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setRole(null);
    window.location.href = "/login";
  }, []);

  return { role, loading, login, logout, waEnabled, isAdmin: role === "admin" };
}
