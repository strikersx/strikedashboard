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
        router.push("/dashboard");
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-black">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 bg-red-600 rounded-lg flex items-center justify-center">
            <TrophyIcon />
          </div>
          <div>
            <h1 className="text-xl font-bold">Striker&apos;s House</h1>
            <p className="text-zinc-500 text-xs">Dashboard de controlo</p>
          </div>
        </div>
        <div className="text-zinc-400 text-sm mb-3 flex items-center gap-2">
          <LockIcon /> Senha de acesso
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="••••••••"
          autoFocus
          className="w-full bg-black border border-zinc-800 rounded-lg p-3 mb-3 focus:outline-none focus:border-red-600 text-white"
        />
        {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
        <button
          onClick={submit}
          disabled={loading || !password}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 px-4 py-3 rounded-lg font-medium transition"
        >
          {loading ? "A entrar..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}
