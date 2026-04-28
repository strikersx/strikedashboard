"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrophyIcon, RefreshIcon, LogoutIcon } from "./icons";
import { Pill } from "./pill";
import type { Role } from "@/lib/constants";
import { ADMIN_ONLY_ROUTES } from "@/lib/constants";

interface NavProps {
  role: Role;
  onRefresh: () => void;
  onLogout: () => void;
  lastFetch: Date | null;
}

const ALL_LINKS = [
  { href: "/dashboard", label: "Visão Geral" },
  { href: "/dashboard/revenue", label: "Faturação" },
  { href: "/dashboard/funnel", label: "Funil" },
  { href: "/dashboard/subscribers", label: "Subscritores" },
  { href: "/dashboard/pts", label: "PTs" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/trials", label: "Experimentais" },
  { href: "/dashboard/trials-no-conv", label: "Trial s/ conv." },
  { href: "/dashboard/churn", label: "Churn" },
  { href: "/dashboard/failed", label: "Falhas" },
  { href: "/dashboard/classes", label: "Visitantes" },
];

export function Nav({ role, onRefresh, onLogout, lastFetch }: NavProps) {
  const pathname = usePathname();
  const isAdmin = role === "admin";

  const links = isAdmin
    ? ALL_LINKS
    : ALL_LINKS.filter((l) => !ADMIN_ONLY_ROUTES.some((r) => l.href.startsWith(r)));

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-red-600 rounded-lg flex items-center justify-center">
            <TrophyIcon />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Striker&apos;s House</h1>
            <p className="text-zinc-500 text-sm">
              {isAdmin ? "Dashboard de controlo · Carcavelos" : "Leads & Conversão · Carcavelos"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill color={isAdmin ? "emerald" : "purple"}>{isAdmin ? "Admin" : "Vendas"}</Pill>
          {lastFetch && (
            <span className="text-zinc-500 text-xs hidden md:block">
              Última act.: {lastFetch.toLocaleTimeString("pt-PT")}
            </span>
          )}
          <button onClick={onRefresh} className="p-2 hover:bg-zinc-800 rounded-lg" title="Atualizar">
            <RefreshIcon />
          </button>
          <button onClick={onLogout} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400" title="Sair">
            <LogoutIcon />
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-4 py-2 text-sm border-b-2 whitespace-nowrap ${
              pathname === href
                ? "border-red-500 text-white"
                : "border-transparent text-zinc-500 hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
