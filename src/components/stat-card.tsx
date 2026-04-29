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
    <div onClick={onClick} className={`bg-surface border rounded-xl p-3 sm:p-4 md:p-5 transition cursor-pointer ${active ? "border-accent" : "border-border-subtle hover:border-border-strong"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${c.bg} ${c.text}`}>{icon}</div>
        {onClick && <span className="text-muted"><ChevronRightIcon /></span>}
      </div>
      <div className="text-muted-strong text-xs font-semibold uppercase tracking-wider mb-1">{label}</div>
      {loading ? (<span className="text-muted"><LoaderIcon /></span>) : error ? (<div className="text-red-500 text-sm">— erro</div>) : (<div className="num text-2xl xl:text-3xl font-bold text-white">{value}</div>)}
      {sublabel && <div className="text-xs text-muted mt-1">{sublabel}</div>}
    </div>
  );
}
