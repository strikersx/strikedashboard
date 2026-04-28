export const ALL_SUB_IDS = [6021, 6107, 6020, 6178, 6361, 6293, 6294, 6153];
export const RECURRING_SUB_IDS = [6021, 6107, 6020, 6153];
export const TRIAL_CLASS_TYPE_ID = 21792;
export const TRIAL_CLASS_PASS_ID = 14172;

export const PLAN_ORDER = [
  "24 sessões/mês",
  "12 sessões/mês",
  "8 sessões/mês",
  "Striking Trimestral",
  "PT (Marcelo) | 3x/sem",
  "PT 4 Passes",
  "PT 8 Passes",
  "PT 12 Passes",
  "Outros",
] as const;

export const PLAN_VALUES: Record<string, number> = {
  "24 sessões/mês": 60,
  "12 sessões/mês": 50,
  "8 sessões/mês": 40,
  "Striking Trimestral": 50,
  "PT (Marcelo) | 3x/sem": 60,
  "PT 4 Passes": 200,
  "PT 8 Passes": 400,
  "PT 12 Passes": 600,
  Outros: 0,
};

export type Role = "admin" | "sales";

export const SALES_VISIBLE_ROUTES = [
  "/dashboard",
  "/dashboard/funnel",
  "/dashboard/leads",
  "/dashboard/trials",
  "/dashboard/classes",
] as const;

export const ADMIN_ONLY_ROUTES = [
  "/dashboard/revenue",
  "/dashboard/churn",
  "/dashboard/failed",
  "/dashboard/subscribers",
  "/dashboard/pts",
] as const;

export const COLOR_MAP = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500", pill: "bg-emerald-950 text-emerald-400" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-500", pill: "bg-blue-950 text-blue-400" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-500", pill: "bg-amber-950 text-amber-400" },
  red: { bg: "bg-red-500/10", text: "text-red-500", pill: "bg-red-950 text-red-400" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-500", pill: "bg-purple-950 text-purple-400" },
  pink: { bg: "bg-pink-500/10", text: "text-pink-500", pill: "bg-pink-950 text-pink-400" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-500", pill: "bg-cyan-950 text-cyan-400" },
} as const;

export type ColorName = keyof typeof COLOR_MAP;
