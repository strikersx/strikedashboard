"use client";

interface IconProps {
  className?: string;
}

function SvgIcon({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
  );
}

export function EuroIcon({ className }: IconProps) { return <SvgIcon d='<line x1="4" y1="9" x2="13" y2="9"/><line x1="4" y1="15" x2="13" y2="15"/><path d="M19 5a7 7 0 1 0 0 14"/>' className={className} />; }
export function UsersIcon({ className }: IconProps) { return <SvgIcon d='<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' className={className} />; }
export function TrendIcon({ className }: IconProps) { return <SvgIcon d='<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>' className={className} />; }
export function CardIcon({ className }: IconProps) { return <SvgIcon d='<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' className={className} />; }
export function ZapIcon({ className }: IconProps) { return <SvgIcon d='<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' className={className} />; }
export function RefreshIcon({ className = "w-4 h-4" }: IconProps) { return <SvgIcon d='<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>' className={className} />; }
export function TrophyIcon({ className = "w-6 h-6" }: IconProps) { return <SvgIcon d='<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>' className={className} />; }
export function LoaderIcon({ className = "w-6 h-6 animate-spin" }: IconProps) { return <SvgIcon d='<line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>' className={className} />; }
export function ChevronRightIcon({ className = "w-4 h-4" }: IconProps) { return <SvgIcon d='<polyline points="9 18 15 12 9 6"/>' className={className} />; }
export function CalendarIcon({ className = "w-3.5 h-3.5" }: IconProps) { return <SvgIcon d='<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' className={className} />; }
export function ClockIcon({ className = "w-3 h-3" }: IconProps) { return <SvgIcon d='<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' className={className} />; }
export function UserPlusIcon({ className }: IconProps) { return <SvgIcon d='<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>' className={className} />; }
export function TargetIcon({ className }: IconProps) { return <SvgIcon d='<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' className={className} />; }
export function CheckIcon({ className = "w-3 h-3" }: IconProps) { return <SvgIcon d='<polyline points="20 6 9 17 4 12"/>' className={className} />; }
export function XIcon({ className = "w-3 h-3" }: IconProps) { return <SvgIcon d='<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' className={className} />; }
export function LockIcon({ className = "w-4 h-4" }: IconProps) { return <SvgIcon d='<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' className={className} />; }
export function LogoutIcon({ className = "w-4 h-4" }: IconProps) { return <SvgIcon d='<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>' className={className} />; }
export function HomeIcon({ className = "w-5 h-5" }: IconProps) { return <SvgIcon d='<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' className={className} />; }
export function FunnelIcon({ className = "w-5 h-5" }: IconProps) { return <SvgIcon d='<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>' className={className} />; }
export function FlameIcon({ className = "w-5 h-5" }: IconProps) { return <SvgIcon d='<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>' className={className} />; }
export function GridIcon({ className = "w-5 h-5" }: IconProps) { return <SvgIcon d='<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' className={className} />; }
export function ChevronIcon({ className = "w-4 h-4" }: IconProps) { return <SvgIcon d='<polyline points="9 18 15 12 9 6"/>' className={className} />; }
