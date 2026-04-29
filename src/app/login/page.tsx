"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrophyIcon, LockIcon } from "@/components/icons";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async () => {
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        setError("Senha inválida");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg">
      <div className="bg-surface border border-border-subtle rounded-2xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 bg-accent rounded-lg flex items-center justify-center">
            <TrophyIcon />
          </div>
          <div>
            <h1 className="text-xl font-bold">Striker&apos;s House</h1>
            <p className="text-muted text-xs">Dashboard de controlo</p>
          </div>
        </div>
        <div className="text-muted-strong text-sm mb-3 flex items-center gap-2">
          <LockIcon /> Senha de acesso
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="••••••••"
          autoFocus
          className="w-full bg-bg border border-border-strong rounded-lg p-3 mb-3 focus:outline-none focus:border-accent text-white"
        />
        {error && <div className="text-tone-coral text-sm mb-3">{error}</div>}
        <button
          onClick={submit}
          disabled={loading || !password}
          className="w-full bg-accent hover:bg-accent/90 text-black disabled:bg-surface2 disabled:text-muted px-4 py-3 rounded-lg font-medium transition"
        >
          {loading ? "A entrar..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}
