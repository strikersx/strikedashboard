"use client";

import { ReactNode } from "react";
import { COLOR_MAP, type ColorName } from "@/lib/constants";
import { ChevronRightIcon, LoaderIcon } from "./icons";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  color: ColorName;
  loading?: boolean;
  error?: string | null;
  onClick?: () => void;
  active?: boolean;
}

export function StatCard({ icon, label, value, sublabel, color, loading, error, onClick, active }: StatCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div onClick={onClick} className={`bg-zinc-900 border rounded-xl p-5 transition cursor-pointer ${active ? "border-red-600" : "border-zinc-800 hover:border-zinc-700"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${c.bg} ${c.text}`}>{icon}</div>
        {onClick && <span className="text-zinc-600"><ChevronRightIcon /></span>}
      </div>
      <div className="text-zinc-400 text-sm mb-1">{label}</div>
      {loading ? (<span className="text-zinc-500"><LoaderIcon /></span>) : error ? (<div className="text-red-500 text-sm">— erro</div>) : (<div className="text-2xl xl:text-3xl font-bold text-white">{value}</div>)}
      {sublabel && <div className="text-xs text-zinc-500 mt-1">{sublabel}</div>}
    </div>
  );
}
