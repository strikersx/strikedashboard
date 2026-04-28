"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { StatCard } from "@/components/stat-card";
import { PaymentBadge } from "@/components/payment-badge";
import { LoaderIcon, UsersIcon, EuroIcon } from "@/components/icons";
import { getPlan, isPTPlan, eur } from "@/lib/utils";
import { ALL_SUB_IDS, PLAN_ORDER, PLAN_VALUES } from "@/lib/constants";
import { Pill } from "@/components/pill";

interface Customer {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  has_membership_membership_description?: string;
}

interface Membership {
  id: number;
  user_id?: number;
  user_full_name?: string;
  membership_type_name?: string;
  membership_type_id?: number;
  paid_until?: string;
  status?: string;
}

interface PlanGroup {
  plan: string;
  customers: (Customer & { paid_until?: string })[];
}

export default function SubscribersPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planGroups, setPlanGroups] = useState<PlanGroup[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [customersRaw, membershipsRaw] = await Promise.all([
        // All customers with any subscription (active or not, as long as not ended)
        fetchReport("reports/customers", {
          filters: [{
            type: "hasMembershipOrClassPass",
            membershipTypeId: ALL_SUB_IDS,
            classPassTypeId: [],
            onlyActiveMembershipsOrClassPasses: false,
          }],
          returnColumnHeaders: true,
        }),
        // All memberships (not just active) for payment info
        fetchReport("reports/memberships-list", {}),
      ]);

      const customers = customersRaw as unknown as Customer[];
      const memberships = membershipsRaw as unknown as Membership[];

      // Build lookup: user_id -> best paid_until
      const paidUntilByUser: Record<number, string> = {};
      for (const m of memberships) {
        if (m.user_id && m.paid_until) {
          const existing = paidUntilByUser[m.user_id];
          if (!existing || m.paid_until > existing) {
            paidUntilByUser[m.user_id] = m.paid_until;
          }
        }
      }

      // Group customers by plan
      const grouped: Record<string, (Customer & { paid_until?: string })[]> = {};
      for (const c of customers) {
        const plan = getPlan(c.has_membership_membership_description);
        if (!grouped[plan]) grouped[plan] = [];
        grouped[plan].push({ ...c, paid_until: paidUntilByUser[c.id] });
      }

      const ordered: PlanGroup[] = PLAN_ORDER
        .filter((p) => grouped[p])
        .map((p) => ({ plan: p as string, customers: grouped[p] }));

      // Add any plans not in PLAN_ORDER
      for (const plan of Object.keys(grouped)) {
        if (!ordered.some((o) => o.plan === plan)) {
          ordered.push({ plan, customers: grouped[plan] });
        }
      }

      const rev = ordered.reduce((sum, g) => sum + g.customers.length * (PLAN_VALUES[g.plan] || 0), 0);

      setPlanGroups(ordered);
      setTotalRevenue(rev);
      setTotalCount(customers.length);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [fetchReport, setLastFetch]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const ptCount = planGroups.filter((g) => isPTPlan(g.plan)).reduce((s, g) => s + g.customers.length, 0);
  const groupCount = totalCount - ptCount;

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-red-500 text-sm">Erro: {error}</div>;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Subscritores ({totalCount})</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<UsersIcon />} label="Total subscritores" value={totalCount} sublabel={`${groupCount} aulas + ${ptCount} PT`} color="blue" />
        <StatCard icon={<EuroIcon />} label="Receita estimada / mês" value={eur(totalRevenue)} color="emerald" />
        <StatCard icon={<UsersIcon />} label="PTs" value={ptCount} color="cyan" />
      </div>

      <div className="space-y-6">
        {planGroups.map(({ plan, customers }) => (
          <div key={plan} className="bg-zinc-800/40 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-white">{plan}</h2>
                {isPTPlan(plan) && <Pill color="cyan">PT</Pill>}
              </div>
              <span className="text-zinc-400 text-sm">{customers.length} · ~{eur(customers.length * (PLAN_VALUES[plan] || 0))}/mês</span>
            </div>
            <div className="space-y-2">
              {customers.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-zinc-700/40 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-zinc-100">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</div>
                    <div className="text-xs text-zinc-500">{c.email || "—"}{c.phone ? ` · ${c.phone}` : ""}</div>
                  </div>
                  <PaymentBadge paidUntil={c.paid_until} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
