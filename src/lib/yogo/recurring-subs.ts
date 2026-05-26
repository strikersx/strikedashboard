import { yogoFetch } from "@/lib/yogo/fetch";
import { RECURRING_SUB_IDS } from "@/lib/constants";
import { normalize } from "@/lib/phone";

export interface ActiveRecurringSub {
  customerId: number;
  firstName: string;
  lastName: string;
  displayName: string;
  phoneRaw: string | null;
  phoneE164: string | null;
  plan: string | null;
}

interface CustomerRow {
  id?: number;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  has_membership_membership_description?: string;
}

interface MembershipRow {
  id?: number;
  user_id?: number;
  membership_type_id?: number;
  membership_type_name?: string;
  status?: string;
  paid_until?: string;
}

const STATUS_PRIORITY: Record<string, number> = { active: 0, cancelled_running: 1, ended: 2 };

export async function fetchActiveRecurringSubs(): Promise<ActiveRecurringSub[]> {
  const [customersRes, membershipsRes] = await Promise.all([
    yogoFetch<unknown>("reports/customers", {
      method: "POST",
      body: JSON.stringify({
        filters: [{
          type: "hasMembershipOrClassPass",
          membershipTypeId: RECURRING_SUB_IDS,
          classPassTypeId: [],
          onlyActiveMembershipsOrClassPasses: false,
        }],
        returnColumnHeaders: true,
      }),
    }),
    yogoFetch<unknown>("reports/memberships-list", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  ]);

  if (!customersRes.ok) throw new Error(`yogo customers ${customersRes.status}`);
  if (!membershipsRes.ok) throw new Error(`yogo memberships ${membershipsRes.status}`);

  const customers = extractRows<CustomerRow>(customersRes.data);
  const memberships = extractRows<MembershipRow>(membershipsRes.data);

  const recurringSet = new Set<number>(RECURRING_SUB_IDS);
  const byCustomer = new Map<number, MembershipRow[]>();
  for (const m of memberships) {
    if (typeof m.user_id !== "number") continue;
    if (typeof m.membership_type_id === "number" && !recurringSet.has(m.membership_type_id)) continue;
    const list = byCustomer.get(m.user_id) ?? [];
    list.push(m);
    byCustomer.set(m.user_id, list);
  }

  const out: ActiveRecurringSub[] = [];
  for (const c of customers) {
    if (typeof c.id !== "number") continue;
    const mbs = byCustomer.get(c.id) ?? [];
    const best = pickBest(mbs);
    if (!best || best.status !== "active") continue;
    const raw = (c.phone ?? "").trim();
    const norm = raw ? normalize(raw) : { e164: null, variants: [] };
    const firstName = (c.first_name ?? "").trim();
    const lastName = (c.last_name ?? "").trim();
    out.push({
      customerId: c.id,
      firstName,
      lastName,
      displayName: [firstName, lastName].filter(Boolean).join(" ") || `#${c.id}`,
      phoneRaw: raw || null,
      phoneE164: norm.e164,
      plan: best.membership_type_name ?? null,
    });
  }
  return out;
}

function pickBest(mbs: MembershipRow[]): MembershipRow | null {
  if (mbs.length === 0) return null;
  return [...mbs].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status ?? ""] ?? 99;
    const pb = STATUS_PRIORITY[b.status ?? ""] ?? 99;
    if (pa !== pb) return pa - pb;
    return (b.paid_until ?? "").localeCompare(a.paid_until ?? "");
  })[0];
}

function extractRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["customers", "memberships", "rows", "data"]) {
      const v = obj[key];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}
