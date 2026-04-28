# Dashboard v2 MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Striker's House dashboard from a single-file Python server to Next.js 15, replicating all existing functionality with the same dark UI.

**Architecture:** Next.js 15 App Router monorepo. API routes handle auth (cookie-based, fixed passwords) and Yogo proxy (passthrough to api.yogo.dk). Client components render dashboard pages. Prisma/SQLite configured but empty in MVP.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Prisma + SQLite

**Source reference:** The current dashboard lives in `strikers-dashboard-server.py` (attached to conversation). All business logic, constants, components, and API calls are extracted from that file.

---

## File Map

### New files to create

| File | Responsibility |
|------|----------------|
| `src/lib/constants.ts` | Business constants (sub IDs, plan order, plan values, class type IDs) |
| `src/lib/auth.ts` | Cookie create/validate/delete, role types |
| `src/lib/yogo-proxy.ts` | Server-side proxy logic: forward request to Yogo API with auth headers |
| `src/lib/utils.ts` | Date helpers, currency formatter, plan classifier |
| `src/app/layout.tsx` | Root layout: dark theme, fonts, metadata |
| `src/app/page.tsx` | Root redirect to /login or /dashboard |
| `src/middleware.ts` | Auth guard for /dashboard/* routes |
| `src/app/login/page.tsx` | Login page with password input |
| `src/app/api/auth/route.ts` | POST: login, GET: check session, DELETE: logout |
| `src/app/api/yogo/[...path]/route.ts` | Catch-all proxy to api.yogo.dk |
| `src/components/icons.tsx` | SVG icon components (euro, users, trend, etc.) |
| `src/components/stat-card.tsx` | KPI card with icon, value, sublabel, color |
| `src/components/pill.tsx` | Colored badge component |
| `src/components/payment-badge.tsx` | Payment status badge (renews in X days, expired, etc.) |
| `src/components/bar-chart.tsx` | SVG bar chart for monthly revenue |
| `src/components/data-table.tsx` | Generic sortable table |
| `src/components/class-list.tsx` | Class list grouped by date |
| `src/components/mini-stat.tsx` | Small stat box used inside pages |
| `src/components/nav.tsx` | Dashboard navigation (sidebar or top tabs), role-aware |
| `src/hooks/use-auth.ts` | Auth state hook: check session, login, logout |
| `src/hooks/use-yogo.ts` | Fetch wrapper for /api/yogo/* with loading/error states |
| `src/app/dashboard/layout.tsx` | Dashboard shell: nav + header + refresh button + role pill |
| `src/app/dashboard/page.tsx` | Overview page (admin) / Sales home (sales) |
| `src/app/dashboard/revenue/page.tsx` | Revenue YTD with monthly chart and top items |
| `src/app/dashboard/funnel/page.tsx` | Conversion funnel (3 stages + action cards) |
| `src/app/dashboard/subscribers/page.tsx` | Subscribers by plan with payment badges |
| `src/app/dashboard/pts/page.tsx` | PT list with next payments and plan breakdown |
| `src/app/dashboard/leads/page.tsx` | Cold leads table (filtered, no USC/internal) |
| `src/app/dashboard/trials/page.tsx` | Trial classes with signups |
| `src/app/dashboard/churn/page.tsx` | Churn risk list (no bookings in 30 days) |
| `src/app/dashboard/failed/page.tsx` | Failed payments list |
| `src/app/dashboard/classes/page.tsx` | USC/ClassPass/Bruce visitors |
| `prisma/schema.prisma` | Prisma config (SQLite, no tables in MVP) |
| `.env.example` | Template for environment variables |
| `.gitignore` | Node, Next.js, env, SQLite ignores |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `prisma/schema.prisma`, `.env.example`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/ricore/Documents/Project/strikehousedashboard
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --turbopack
```

When prompted: accept defaults. If directory is non-empty, it will ask to proceed — say yes.

- [ ] **Step 2: Install Prisma**

```bash
npm install prisma @prisma/client
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 3: Configure Prisma schema**

Replace `prisma/schema.prisma` with:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

- [ ] **Step 4: Create .env.example**

```env
# Auth
ADMIN_PWD=carcavelos2026
SALES_PWD=leads2026

# Yogo API
YOGO_TOKEN=your-yogo-jwt-token
YOGO_BASE=https://api.yogo.dk
YOGO_ORIGIN=https://strikershouse.yogobooking.pt

# Database (MVP: local SQLite)
DATABASE_URL="file:./dev.db"
```

Copy to `.env.local` with real values.

- [ ] **Step 5: Update .gitignore**

Append to `.gitignore`:

```
.env.local
*.db
*.db-journal
~/.strikers/
```

- [ ] **Step 6: Configure root layout with dark theme**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Striker's House — Dashboard",
  description: "Dashboard de controlo operacional",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className="dark">
      <body className="bg-black text-white font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Update globals.css for dark defaults**

Replace `src/app/globals.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 8: Root page redirect**

Replace `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");
}
```

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev
```

Open `http://localhost:3000` — should redirect to `/login` (404 is expected, page doesn't exist yet).

- [ ] **Step 10: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js 15 project with Tailwind, Prisma, TypeScript"
```

---

## Task 2: Constants & Utilities

**Files:**
- Create: `src/lib/constants.ts`, `src/lib/utils.ts`

- [ ] **Step 1: Create business constants**

Create `src/lib/constants.ts`:

```typescript
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
```

- [ ] **Step 2: Create utility functions**

Create `src/lib/utils.ts`:

```typescript
export function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function eur(n: number): string {
  return "€" + (n || 0).toLocaleString("pt-PT", { maximumFractionDigits: 0 });
}

export function monthLabel(m: number): string {
  return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m];
}

export function getToday(): string {
  return fmtDate(new Date());
}

export function getWeekEnd(): string {
  const t = new Date();
  t.setDate(t.getDate() + 6);
  return fmtDate(t);
}

export function getMonthEnd(): string {
  const t = new Date();
  return fmtDate(new Date(t.getFullYear(), t.getMonth() + 1, 0));
}

export function getDashboardRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const minEnd = new Date(today);
  minEnd.setDate(today.getDate() + 7);
  const end = endOfMonth > minEnd ? endOfMonth : minEnd;
  return { startDate: fmtDate(today), endDate: fmtDate(end) };
}

export function getLast30Days(): { startDate: string; endDate: string } {
  const t = new Date();
  const p = new Date(t);
  p.setDate(t.getDate() - 30);
  return { startDate: fmtDate(p), endDate: fmtDate(t) };
}

export function isToday(dateStr: string): boolean {
  return dateStr === getToday();
}

export function isThisWeek(dateStr: string): boolean {
  return dateStr >= getToday() && dateStr <= getWeekEnd();
}

export function isThisMonth(dateStr: string): boolean {
  return dateStr >= getToday() && dateStr <= getMonthEnd();
}

export function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getPlan(desc: string | null | undefined): string {
  if (!desc) return "Outros";
  if (/PT 12 Passes/i.test(desc)) return "PT 12 Passes";
  if (/PT 8 Passes/i.test(desc)) return "PT 8 Passes";
  if (/PT 4 Passes/i.test(desc)) return "PT 4 Passes";
  if (/PT \(Marcelo\)/i.test(desc)) return "PT (Marcelo) | 3x/sem";
  if (/24 sessões\/mês/i.test(desc)) return "24 sessões/mês";
  if (/12 sessões\/mês/i.test(desc)) return "12 sessões/mês";
  if (/8 sessões\/mês/i.test(desc)) return "8 sessões/mês";
  if (/Striking Trimestral/i.test(desc)) return "Striking Trimestral";
  return "Outros";
}

export function isPTPlan(plan: string): boolean {
  return /^PT/.test(plan);
}

export function isNonActionableLead(customer: { email?: string }): boolean {
  const email = (customer.email || "").toLowerCase();
  if (email.startsWith("usc-") && email.includes("urbansportsclub.com")) return true;
  if (email.includes("@strikershouse.") || email.includes("@striker.pt") || email.includes("@strikerhouse.com"))
    return true;
  return false;
}

// Parse Yogo report responses into flat arrays of objects
export function parseReport(response: unknown): Record<string, unknown>[] {
  if (!response) return [];
  if (Array.isArray(response)) {
    if (response.length === 0) return [];
    if (typeof response[0] === "object" && !Array.isArray(response[0])) return response;
    if (Array.isArray(response[0])) {
      const [headers, ...rows] = response as unknown[][];
      return rows.map((row) =>
        Object.fromEntries((headers as string[]).map((h, i) => [h, row[i]]))
      );
    }
  }
  const obj = response as Record<string, unknown>;
  if (obj.data !== undefined) return parseReport(obj.data);
  if (Array.isArray(obj.rows)) {
    const headers = (obj.columns || obj.headers || obj.columnHeaders) as string[] | undefined;
    if (headers && obj.rows.length > 0 && Array.isArray(obj.rows[0])) {
      return (obj.rows as unknown[][]).map((row) =>
        Object.fromEntries(headers.map((h, i) => [h, row[i]]))
      );
    }
    return obj.rows as Record<string, unknown>[];
  }
  if (obj.result) return parseReport(obj.result);
  if (obj.results) return parseReport(obj.results);
  if (obj.customers) return parseReport(obj.customers);
  if (obj.users) return parseReport(obj.users);
  return [];
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/utils.ts
git commit -m "feat: add business constants and utility functions"
```

---

## Task 3: Auth Backend

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/route.ts`, `src/middleware.ts`

- [ ] **Step 1: Create auth library**

Create `src/lib/auth.ts`:

```typescript
import { cookies } from "next/headers";
import type { Role } from "./constants";

const COOKIE_NAME = "striker_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function validatePassword(password: string): Role | null {
  if (password === process.env.ADMIN_PWD) return "admin";
  if (password === process.env.SALES_PWD) return "sales";
  return null;
}

export async function createSession(role: Role): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function getSession(): Promise<Role | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session) return null;
  if (session.value === "admin" || session.value === "sales") return session.value;
  return null;
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
```

- [ ] **Step 2: Create auth API route**

Create `src/app/api/auth/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { validatePassword, createSession, getSession, deleteSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json();
  const role = validatePassword(body.password || "");

  if (!role) {
    return NextResponse.json({ error: "senha inválida" }, { status: 401 });
  }

  await createSession(role);
  return NextResponse.json({ role });
}

export async function GET() {
  const role = await getSession();
  if (!role) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ role });
}

export async function DELETE() {
  await deleteSession();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create middleware**

Create `src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_ONLY_ROUTES } from "./lib/constants";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("striker_session");
  const { pathname } = request.nextUrl;

  // Protect /dashboard routes
  if (pathname.startsWith("/dashboard")) {
    if (!session || (session.value !== "admin" && session.value !== "sales")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Block sales from admin-only routes
    if (session.value === "sales" && ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Redirect logged-in users away from login
  if (pathname === "/login" && session && (session.value === "admin" || session.value === "sales")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/route.ts src/middleware.ts
git commit -m "feat: add auth system with cookie sessions and role-based middleware"
```

---

## Task 4: Yogo Proxy

**Files:**
- Create: `src/lib/yogo-proxy.ts`, `src/app/api/yogo/[...path]/route.ts`

- [ ] **Step 1: Create proxy library**

Create `src/lib/yogo-proxy.ts`:

```typescript
export async function proxyToYogo(
  apiPath: string,
  method: string = "GET",
  body?: string | null
): Promise<Response> {
  const base = process.env.YOGO_BASE || "https://api.yogo.dk";
  const token = process.env.YOGO_TOKEN;
  const origin = process.env.YOGO_ORIGIN || "https://strikershouse.yogobooking.pt";

  const url = `${base}/${apiPath}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "x-yogo-request-context": "admin",
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    Origin: origin,
    Referer: `${origin}/`,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body || undefined,
  });

  const data = await res.text();

  return new Response(data, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 2: Create catch-all API route**

Create `src/app/api/yogo/[...path]/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { proxyToYogo } from "@/lib/yogo-proxy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = path.join("/");
  const search = req.nextUrl.search;
  return proxyToYogo(apiPath + search);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = path.join("/");
  const body = await req.text();
  return proxyToYogo(apiPath, "POST", body);
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/yogo-proxy.ts "src/app/api/yogo/[...path]/route.ts"
git commit -m "feat: add Yogo API proxy passthrough"
```

---

## Task 5: Shared Components

**Files:**
- Create: `src/components/icons.tsx`, `src/components/stat-card.tsx`, `src/components/pill.tsx`, `src/components/payment-badge.tsx`, `src/components/mini-stat.tsx`, `src/components/bar-chart.tsx`, `src/components/data-table.tsx`, `src/components/class-list.tsx`

- [ ] **Step 1: Create icons**

Create `src/components/icons.tsx`:

```tsx
"use client";

interface IconProps {
  className?: string;
}

function SvgIcon({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}

export function EuroIcon({ className }: IconProps) {
  return <SvgIcon d='<line x1="4" y1="9" x2="13" y2="9"/><line x1="4" y1="15" x2="13" y2="15"/><path d="M19 5a7 7 0 1 0 0 14"/>' className={className} />;
}

export function UsersIcon({ className }: IconProps) {
  return <SvgIcon d='<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' className={className} />;
}

export function TrendIcon({ className }: IconProps) {
  return <SvgIcon d='<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>' className={className} />;
}

export function CardIcon({ className }: IconProps) {
  return <SvgIcon d='<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' className={className} />;
}

export function ZapIcon({ className }: IconProps) {
  return <SvgIcon d='<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' className={className} />;
}

export function RefreshIcon({ className = "w-4 h-4" }: IconProps) {
  return <SvgIcon d='<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>' className={className} />;
}

export function TrophyIcon({ className = "w-6 h-6" }: IconProps) {
  return <SvgIcon d='<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>' className={className} />;
}

export function LoaderIcon({ className = "w-6 h-6 animate-spin" }: IconProps) {
  return <SvgIcon d='<line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>' className={className} />;
}

export function ChevronRightIcon({ className = "w-4 h-4" }: IconProps) {
  return <SvgIcon d='<polyline points="9 18 15 12 9 6"/>' className={className} />;
}

export function CalendarIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return <SvgIcon d='<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' className={className} />;
}

export function ClockIcon({ className = "w-3 h-3" }: IconProps) {
  return <SvgIcon d='<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' className={className} />;
}

export function UserPlusIcon({ className }: IconProps) {
  return <SvgIcon d='<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>' className={className} />;
}

export function TargetIcon({ className }: IconProps) {
  return <SvgIcon d='<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' className={className} />;
}

export function CheckIcon({ className = "w-3 h-3" }: IconProps) {
  return <SvgIcon d='<polyline points="20 6 9 17 4 12"/>' className={className} />;
}

export function XIcon({ className = "w-3 h-3" }: IconProps) {
  return <SvgIcon d='<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' className={className} />;
}

export function LockIcon({ className = "w-4 h-4" }: IconProps) {
  return <SvgIcon d='<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' className={className} />;
}

export function LogoutIcon({ className = "w-4 h-4" }: IconProps) {
  return <SvgIcon d='<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>' className={className} />;
}
```

- [ ] **Step 2: Create StatCard**

Create `src/components/stat-card.tsx`:

```tsx
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
    <div
      onClick={onClick}
      className={`bg-zinc-900 border rounded-xl p-5 transition cursor-pointer ${
        active ? "border-red-600" : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${c.bg} ${c.text}`}>{icon}</div>
        {onClick && <span className="text-zinc-600"><ChevronRightIcon /></span>}
      </div>
      <div className="text-zinc-400 text-sm mb-1">{label}</div>
      {loading ? (
        <span className="text-zinc-500"><LoaderIcon /></span>
      ) : error ? (
        <div className="text-red-500 text-sm">— erro</div>
      ) : (
        <div className="text-2xl xl:text-3xl font-bold text-white">{value}</div>
      )}
      {sublabel && <div className="text-xs text-zinc-500 mt-1">{sublabel}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Create Pill**

Create `src/components/pill.tsx`:

```tsx
import { ReactNode } from "react";
import { COLOR_MAP, type ColorName } from "@/lib/constants";

interface PillProps {
  children: ReactNode;
  color?: ColorName;
}

export function Pill({ children, color = "blue" }: PillProps) {
  return (
    <span className={`${COLOR_MAP[color].pill} px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Create PaymentBadge**

Create `src/components/payment-badge.tsx`:

```tsx
import { Pill } from "./pill";
import { daysUntil } from "@/lib/utils";

interface PaymentBadgeProps {
  paidUntil: string | null | undefined;
}

export function PaymentBadge({ paidUntil }: PaymentBadgeProps) {
  if (!paidUntil) return <Pill color="amber">pago externamente</Pill>;
  const days = daysUntil(paidUntil);
  if (days === null) return <Pill color="amber">pago externamente</Pill>;
  if (days < 0) return <Pill color="red">venceu há {-days}d</Pill>;
  if (days === 0) return <Pill color="red">renova hoje</Pill>;
  if (days <= 3) return <Pill color="red">renova em {days}d</Pill>;
  if (days <= 7) return <Pill color="amber">renova em {days}d</Pill>;
  return <Pill color="emerald">renova em {days}d</Pill>;
}
```

- [ ] **Step 5: Create MiniStat**

Create `src/components/mini-stat.tsx`:

```tsx
interface MiniStatProps {
  label: string;
  value: string | number;
  color?: "white" | "emerald" | "purple" | "pink" | "cyan" | "blue";
}

const TEXT_COLORS = {
  white: "text-white",
  emerald: "text-emerald-400",
  purple: "text-purple-400",
  pink: "text-pink-400",
  cyan: "text-cyan-400",
  blue: "text-blue-400",
};

export function MiniStat({ label, value, color = "white" }: MiniStatProps) {
  return (
    <div className="bg-black/40 rounded-lg p-3">
      <div className="text-zinc-500 text-xs mb-1">{label}</div>
      <div className={`text-xl xl:text-2xl font-bold ${TEXT_COLORS[color]}`}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 6: Create BarChart**

Create `src/components/bar-chart.tsx`:

```tsx
"use client";

import { eur } from "@/lib/utils";

interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  currentIdx?: number;
}

export function BarChart({ data, height = 240, currentIdx }: BarChartProps) {
  const W = 700;
  const H = height;
  const pad = { top: 10, right: 10, bottom: 30, left: 55 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;
  const maxV = Math.max(...data.map((d) => d.value), 1);
  const bw = (cw / data.length) * 0.7;
  const gp = (cw / data.length) * 0.3;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const fmtTick = (v: number) => (v >= 1000 ? "€" + (v / 1000).toFixed(1) + "k" : "€" + Math.round(v));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={pad.left} x2={W - pad.right}
            y1={pad.top + ch * (1 - t)} y2={pad.top + ch * (1 - t)}
            stroke="#27272a" strokeDasharray="3 3"
          />
          <text x={pad.left - 6} y={pad.top + ch * (1 - t) + 4} fill="#71717a" fontSize="11" textAnchor="end">
            {fmtTick(maxV * t)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = pad.left + i * (cw / data.length) + gp / 2;
        const h = (d.value / maxV) * ch;
        const y = pad.top + ch - h;
        const fill = i === currentIdx ? "#10b981" : i < (currentIdx ?? -1) ? "#059669" : "#3f3f46";
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} fill={fill} rx={3}>
              <title>{d.label}: {eur(d.value)}</title>
            </rect>
            <text x={x + bw / 2} y={H - pad.bottom + 16} fill="#a1a1aa" fontSize="11" textAnchor="middle">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 7: Create DataTable**

Create `src/components/data-table.tsx`:

```tsx
"use client";

import { LoaderIcon } from "./icons";

interface DataTableProps {
  rows: Record<string, unknown>[] | undefined;
  loading?: boolean;
  error?: string | null;
  title?: string;
  empty?: string;
  maxCols?: number;
}

export function DataTable({ rows, loading, error, title, empty = "Sem dados", maxCols = 8 }: DataTableProps) {
  if (loading) return <div className="py-12 text-center"><LoaderIcon /></div>;
  if (error) return <div className="py-12 text-center text-red-500 text-sm">Erro: {error}</div>;
  if (!rows || rows.length === 0) return <div className="py-12 text-center text-zinc-500">{empty}</div>;

  const cols = Object.keys(rows[0]).slice(0, maxCols);

  return (
    <div>
      {title && (
        <h2 className="text-lg font-semibold mb-4">
          {title} <span className="text-zinc-500 font-normal">({rows.length})</span>
        </h2>
      )}
      <div className="overflow-x-auto -mx-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {cols.map((c) => (
                <th key={c} className="text-left p-2 px-3 text-zinc-500 font-medium text-xs uppercase tracking-wide">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-zinc-800/40 hover:bg-black/40">
                {cols.map((c) => (
                  <td key={c} className="p-2 px-3 text-zinc-300">
                    {String(row[c] ?? "—").slice(0, 80)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create ClassList**

Create `src/components/class-list.tsx`:

```tsx
"use client";

import { isToday, getToday } from "@/lib/utils";
import { TRIAL_CLASS_TYPE_ID } from "@/lib/constants";
import { CalendarIcon, ClockIcon } from "./icons";
import { Pill } from "./pill";

interface ClassItem {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  signup_count?: number;
  checked_in_count?: number;
  waiting_list_count?: number;
  urban_sports_club_signup_count?: number;
  classpass_com_signup_count?: number;
  bruce_app_signup_count?: number;
  class_type_id?: number;
  class_type?: { name?: string };
  teachers?: { first_name?: string; last_name?: string }[];
  room?: { name?: string };
}

interface ClassListProps {
  classes: ClassItem[];
  mode?: "trial" | "visitors";
  empty?: string;
}

export function ClassList({ classes, mode = "trial", empty = "Sem aulas" }: ClassListProps) {
  if (!classes || classes.length === 0) {
    return <div className="py-12 text-center text-zinc-500">{empty}</div>;
  }

  const byDate: Record<string, ClassItem[]> = {};
  classes.forEach((c) => {
    const d = c.date || "unknown";
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(c);
  });

  const dateLabel = (date: string) => {
    if (date === "unknown") return date;
    const dateObj = new Date(date);
    const today = getToday();
    const formatted = dateObj.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
    return date === today ? `HOJE · ${formatted}` : formatted;
  };

  return (
    <div className="space-y-5">
      {Object.entries(byDate).map(([date, list]) => {
        const isHoje = isToday(date);
        return (
          <div key={date}>
            <h3 className={`text-sm mb-2 font-semibold uppercase tracking-wide flex items-center gap-2 ${isHoje ? "text-emerald-400" : "text-zinc-400"}`}>
              <CalendarIcon /> {dateLabel(date)}
            </h3>
            <div className="space-y-2">
              {list.map((c) => {
                const visitorCount = (c.urban_sports_club_signup_count || 0) + (c.classpass_com_signup_count || 0) + (c.bruce_app_signup_count || 0);
                const newCount = mode === "trial" ? (c.signup_count || 0) : visitorCount;
                const borderClr = mode === "trial" ? "border-emerald-500" : "border-blue-500";
                const textClr = mode === "trial" ? "text-emerald-400" : "text-blue-400";

                return (
                  <div key={c.id} className={`bg-black/40 rounded-lg p-3 border-l-4 ${borderClr}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          {c.class_type?.name || "Aula"}
                          <span className={`text-sm font-bold ${textClr}`}>+{newCount}</span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1">
                            <ClockIcon />
                            {(c.start_time || "").slice(0, 5)} — {(c.end_time || "").slice(0, 5)}
                          </span>
                          {c.teachers?.[0]?.first_name && (
                            <span>· {c.teachers[0].first_name} {c.teachers[0].last_name || ""}</span>
                          )}
                          {c.room?.name && <span>{c.room.name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs flex-wrap justify-end">
                        {(c.signup_count || 0) > 0 && <Pill color="blue">{c.signup_count} insc.</Pill>}
                        {(c.checked_in_count || 0) > 0 && <Pill color="emerald">{c.checked_in_count} check-in</Pill>}
                        {(c.urban_sports_club_signup_count || 0) > 0 && <Pill color="purple">USC {c.urban_sports_club_signup_count}</Pill>}
                        {(c.classpass_com_signup_count || 0) > 0 && <Pill color="pink">CP {c.classpass_com_signup_count}</Pill>}
                        {(c.bruce_app_signup_count || 0) > 0 && <Pill color="cyan">Bruce {c.bruce_app_signup_count}</Pill>}
                        {(c.waiting_list_count || 0) > 0 && <Pill color="amber">+{c.waiting_list_count} espera</Pill>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 9: Verify build**

```bash
npm run build
```

- [ ] **Step 10: Commit**

```bash
git add src/components/
git commit -m "feat: add shared UI components (icons, StatCard, Pill, BarChart, DataTable, ClassList)"
```

---

## Task 6: Auth Hook & Login Page

**Files:**
- Create: `src/hooks/use-auth.ts`, `src/app/login/page.tsx`

- [ ] **Step 1: Create auth hook**

Create `src/hooks/use-auth.ts`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Role } from "@/lib/constants";

export function useAuth() {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRole(data?.role ?? null))
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

  return { role, loading, login, logout, isAdmin: role === "admin" };
}
```

- [ ] **Step 2: Create login page**

Create `src/app/login/page.tsx`:

```tsx
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
```

- [ ] **Step 3: Verify login flow works**

```bash
npm run dev
```

Open `http://localhost:3000` — should see login page. Enter admin password — should redirect to `/dashboard` (404 expected since page doesn't exist yet).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-auth.ts src/app/login/page.tsx
git commit -m "feat: add login page and auth hook"
```

---

## Task 7: Yogo Fetch Hook

**Files:**
- Create: `src/hooks/use-yogo.ts`

- [ ] **Step 1: Create useYogo hook**

Create `src/hooks/use-yogo.ts`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { parseReport } from "@/lib/utils";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useYogoFetch() {
  const fetchYogo = useCallback(async (path: string, options?: RequestInit) => {
    const res = await fetch("/api/yogo/" + path, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }, []);

  const fetchReport = useCallback(
    async (path: string, body: unknown) => {
      const raw = await fetchYogo(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return parseReport(raw);
    },
    [fetchYogo]
  );

  const fetchGraphQL = useCallback(
    async (query: string, variables: unknown) => {
      const res = await fetch("/api/yogo/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    },
    []
  );

  return { fetchYogo, fetchReport, fetchGraphQL };
}

export function useDataFetch<T>(fetcher: () => Promise<T>): FetchState<T> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: false, error: null });

  const refetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcher();
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }, [fetcher]);

  return { ...state, refetch };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-yogo.ts
git commit -m "feat: add Yogo API fetch hooks"
```

---

## Task 8: Dashboard Layout & Navigation

**Files:**
- Create: `src/components/nav.tsx`, `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Create Nav component**

Create `src/components/nav.tsx`:

```tsx
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
```

- [ ] **Step 2: Create dashboard layout**

Create `src/app/dashboard/layout.tsx`:

```tsx
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

  if (!role) return null; // middleware handles redirect

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
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/nav.tsx src/app/dashboard/layout.tsx
git commit -m "feat: add dashboard layout with navigation and role-based tabs"
```

---

## Task 9: Overview Page (Admin) & Sales Home

**Files:**
- Create: `src/app/dashboard/page.tsx`

This is the largest page — it combines the overview (admin) and sales home (sales) into one page that switches based on role. It also renders the KPI stat cards at the top.

- [ ] **Step 1: Create dashboard overview page**

Create `src/app/dashboard/page.tsx`. This file is long (~300 lines) because it contains all the data fetching logic and both admin/sales views. The engineer should extract this from the original Python dashboard's `<App>`, `<Overview>`, and `<SalesHome>` components.

The page must:
1. Detect role via `useAuth()`
2. Fetch all relevant Yogo data on mount (and on `refreshKey` change)
3. Render KPI stat cards (admin sees 2 rows, sales sees 1)
4. Render either `Overview` (admin) or `SalesHome` (sales) content below

**Key data fetches needed:**
- `fetchActiveSubs` — POST `/reports/customers` with `hasMembershipOrClassPass` filter
- `fetchActiveMemberships` — POST `/reports/memberships-list` with `status: ['active']`
- `fetchChurn` — POST `/reports/customers` with zero signups + active membership
- `fetchFailed` — POST `/reports/memberships-list` with `payment_failed`
- `fetchLeads` — POST `/reports/customers` with no membership + no class pass
- `fetchTrialNoConv` — POST `/reports/customers` with no membership + trial class pass
- `fetchTrialAttended` — POST `/reports/customers` with trial attendance check
- `fetchClasses` — GET `/classes` with date range + populate params
- `fetchRevenue` — POST `/graphql` with `revenueReport` query

All fetch functions, filter constants, and derived state calculations exist in the Python source's `<App>` component. Port them to TypeScript using `useYogoFetch()`.

**This task is intentionally left as a porting exercise** — the logic maps 1:1 from the Python HTML. The engineer should read `strikers-dashboard-server.py` lines where `fetchActiveSubs`, `fetchChurn`, etc. are defined and replicate each one.

- [ ] **Step 2: Verify page renders**

```bash
npm run dev
```

Login as admin at `http://localhost:3000`, verify KPI cards load with Yogo data.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: add dashboard overview page with KPI cards and data fetching"
```

---

## Task 10: Revenue Page

**Files:**
- Create: `src/app/dashboard/revenue/page.tsx`

- [ ] **Step 1: Create revenue page**

Port the `<Revenue>` component from the Python dashboard. Uses `fetchGraphQL` for the `revenueReport` query. Renders:
- 4 mini stats (total c/ IVA, s/ IVA, IVA, média mensal)
- Monthly bar chart via `<BarChart>`
- Top items by revenue (progress bars)
- Revenue by item type (progress bars)

The GraphQL query is:
```typescript
const query = `query revenueReport($input: RevenueReportInput!) {
  revenueReport(input: $input) {
    label startDate endDate
    items { itemType itemId itemCount name totalExVat vat totalInclVat vatPercentage eventStartDate }
  }
}`;
const variables = {
  input: {
    periodType: "year",
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    dateFilterField: "paid",
    vatFilter: null,
    canHandleSeparateRefunds: true,
  },
};
```

- [ ] **Step 2: Verify**

Open `/dashboard/revenue` — should show revenue chart and breakdowns.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/revenue/page.tsx
git commit -m "feat: add revenue page with monthly chart and breakdowns"
```

---

## Task 11: Funnel Page

**Files:**
- Create: `src/app/dashboard/funnel/page.tsx`

- [ ] **Step 1: Create funnel page**

Port the `<Funnel>` component. Receives leads count, trialNoConv count, subs count via data fetching. Renders 3 stages with progress bars + 3 action cards below.

Note: this page needs its own data fetching (leads count, trial count, subs count) or can receive them from a shared data context. For simplicity, fetch independently.

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/funnel/page.tsx
git commit -m "feat: add conversion funnel page"
```

---

## Task 12: Remaining Dashboard Pages

**Files:**
- Create: `src/app/dashboard/subscribers/page.tsx`
- Create: `src/app/dashboard/pts/page.tsx`
- Create: `src/app/dashboard/leads/page.tsx`
- Create: `src/app/dashboard/trials/page.tsx`
- Create: `src/app/dashboard/churn/page.tsx`
- Create: `src/app/dashboard/failed/page.tsx`
- Create: `src/app/dashboard/classes/page.tsx`

Each page follows the same pattern: fetch from Yogo via `/api/yogo/*`, process data, render with shared components.

- [ ] **Step 1: Subscribers page** — Port `<SubsList>`. Fetches active subs, groups by plan via `getPlan()`, shows `<PaymentBadge>` per subscriber.

- [ ] **Step 2: PTs page** — Port `<PTList>`. Same as subscribers but filtered to PT plans only. Shows next payments section.

- [ ] **Step 3: Leads page** — Port leads table. Fetches customers with no membership + no class pass, filters out USC/internal via `isNonActionableLead()`, renders `<DataTable>`.

- [ ] **Step 4: Trials page** — Port `<NewStudentsView>` in trial mode. Fetches classes with `class_type = TRIAL_CLASS_TYPE_ID`, renders `<ClassList>` with today/week/month counts.

- [ ] **Step 5: Churn page** — Fetches customers with zero signups in last 30 days + active recurring subscription. Renders `<DataTable>`.

- [ ] **Step 6: Failed page** — Port `<FailedList>`. Fetches ended memberships with `payment_failed`. Renders custom list with `<Pill color="red">`.

- [ ] **Step 7: Classes page** — Port `<NewStudentsView>` in visitors mode. Fetches all classes, filters to those with USC/ClassPass/Bruce signups, renders `<ClassList>`.

- [ ] **Step 8: Verify all pages load**

Navigate to each page in the browser, confirm data loads correctly.

- [ ] **Step 9: Commit**

```bash
git add src/app/dashboard/
git commit -m "feat: add all dashboard pages (subscribers, PTs, leads, trials, churn, failed, classes)"
```

---

## Task 13: Trial Without Conversion Page (Special)

**Files:**
- Create: override `src/app/dashboard/trials/page.tsx` to include both trial classes AND trial-no-conversion list

Actually, looking at the original dashboard, there are two separate trial-related views:
- **Trials tab** — classes with signups (NewStudentsView in trial mode)
- **Trial s/ conv. tab** — customers who did a trial but didn't convert (TrialNoConvList)

The spec maps these to:
- `/dashboard/trials` — trial classes with signups
- We need a separate route for trial-no-conversion

- [ ] **Step 1: Add trials-no-conv page**

Create `src/app/dashboard/trials-no-conv/page.tsx` — port `<TrialNoConvList>`. Fetches:
1. Customers with no membership + trial class pass (trialNoConv)
2. Among those, who actually attended (trialAttended)

Renders two sections: "Foram à aula" (hot leads with pink border) and "Faltaram / agendado" (amber).

- [ ] **Step 2: Add link in nav**

Update `src/components/nav.tsx` to include the trials-no-conv link.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/trials-no-conv/ src/components/nav.tsx
git commit -m "feat: add trial without conversion page"
```

---

## Task 14: Final Polish & Verify

- [ ] **Step 1: Update root page redirect logic**

Update `src/app/page.tsx` to check session and redirect to `/dashboard` if logged in:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const role = await getSession();
  if (role) redirect("/dashboard");
  redirect("/login");
}
```

- [ ] **Step 2: Run full build**

```bash
npm run build
```

Fix any TypeScript or build errors.

- [ ] **Step 3: Test complete flow**

1. Open `http://localhost:3000` → redirects to `/login`
2. Login with admin password → see overview with KPI cards
3. Navigate each tab → data loads from Yogo
4. Logout → back to login
5. Login with sales password → see reduced nav (no Revenue, Churn, Failed, Subscribers, PTs)
6. Try navigating to `/dashboard/revenue` as sales → redirected to `/dashboard`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete MVP — all dashboard pages migrated to Next.js 15"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Project scaffolding | 9 files |
| 2 | Constants & utilities | 2 files |
| 3 | Auth backend | 3 files |
| 4 | Yogo proxy | 2 files |
| 5 | Shared components | 8 files |
| 6 | Login page + auth hook | 2 files |
| 7 | Yogo fetch hook | 1 file |
| 8 | Dashboard layout + nav | 2 files |
| 9 | Overview/Sales home page | 1 file |
| 10 | Revenue page | 1 file |
| 11 | Funnel page | 1 file |
| 12 | Remaining pages (7) | 7 files |
| 13 | Trial no-conv page | 2 files |
| 14 | Final polish | 1 file |

**Total: 14 tasks, ~42 files, 14 commits**
