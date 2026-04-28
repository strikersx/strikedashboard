"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { StatCard } from "@/components/stat-card";
import { PaymentBadge } from "@/components/payment-badge";
import { LoaderIcon, UsersIcon, EuroIcon } from "@/components/icons";
import { getPlan, isPTPlan, eur } from "@/lib/utils";
import { PLAN_ORDER, PLAN_VALUES } from "@/lib/constants";

interface Membership {
  id: number;
  user_id?: number;
  user_full_name?: string;
  user_first_name?: string;
  user_last_name?: string;
  user_email?: string;
  user_phone?: string;
  membership_type_name?: string;
  membership_type_id?: number;
  status?: string;
  paid_until?: string;
  start_date?: string;
  next_payment?: { date?: string; amount?: number };
}

interface PlanGroup {
  plan: string;
  memberships: Membership[];
}

function memberName(m: Membership): string {
  return m.user_full_name || [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || "—";
}

export default function SubscribersPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planGroups, setPlanGroups] = useState<PlanGroup[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchReport("reports/memberships-list", { status: ["active"] });
      const memberships = raw as unknown as Membership[];

      const subMemberships = memberships.filter((m) => {
        const plan = getPlan(m.membership_type_name);
        return !isPTPlan(plan);
      });

      const grouped: Record<string, Membership[]> = {};
      for (const m of subMemberships) {
        const plan = getPlan(m.membership_type_name);
        if (!grouped[plan]) grouped[plan] = [];
        grouped[plan].push(m);
      }

      const ordered = PLAN_ORDER.filter((p) => !isPTPlan(p) && grouped[p])
        .map((p) => ({ plan: p, memberships: grouped[p] }));

      const rev = ordered.reduce((sum, g) => sum + g.memberships.length * (PLAN_VALUES[g.plan] || 0), 0);

      setPlanGroups(ordered);
      setTotalRevenue(rev);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [fetchReport, setLastFetch]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const totalSubs = planGroups.reduce((s, g) => s + g.memberships.length, 0);

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-red-500 text-sm">Erro: {error}</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Subscritores Ativos</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={<UsersIcon />} label="Total subscritores" value={totalSubs} color="blue" />
        <StatCard icon={<EuroIcon />} label="Receita estimada / mês" value={eur(totalRevenue)} color="emerald" />
      </div>

      <div className="space-y-6">
        {planGroups.map(({ plan, memberships }) => (
          <div key={plan} className="bg-zinc-800/40 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">{plan}</h2>
              <span className="text-zinc-400 text-sm">{memberships.length} sub{memberships.length !== 1 ? "s" : ""} · {eur(memberships.length * (PLAN_VALUES[plan] || 0))}/mês</span>
            </div>
            <div className="space-y-2">
              {memberships.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-zinc-700/40 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-zinc-100">{memberName(m)}</div>
                    <div className="text-xs text-zinc-500">{m.user_email || "—"}{m.user_phone ? ` · ${m.user_phone}` : ""}</div>
                  </div>
                  <PaymentBadge paidUntil={m.paid_until} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
