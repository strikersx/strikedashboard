import { ReactNode } from "react";
import { COLOR_MAP, type ColorName } from "@/lib/constants";

interface PillProps { children: ReactNode; color?: ColorName; }

export function Pill({ children, color = "blue" }: PillProps) {
  return <span className={`${COLOR_MAP[color].pill} px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1`}>{children}</span>;
}
