"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { StatCard } from "@/components/stat-card";
import { PaymentBadge } from "@/components/payment-badge";
import { LoaderIcon, UsersIcon, EuroIcon } from "@/components/icons";
import { getPlan, isPTPlan, eur, daysUntil } from "@/lib/utils";
import { PLAN_ORDER, PLAN_VALUES } from "@/lib/constants";

interface Membership {
  id: number;
  status?: string;
  paid_until?: string;
  membership_type?: { name?: string };
  customer?: { id?: number; first_name?: string; last_name?: string; email?: string };
  [key: string]: unknown;
}

interface PlanGroup {
  plan: string;
  memberships: Membership[];
}

export default function PTsPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchYogo } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planGroups, setPlanGroups] = useState<PlanGroup[]>([]);
  const [upcoming, setUpcoming] = useState<Membership[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const membershipsRaw = await fetchYogo(
        "memberships-list?status[]=active&populate[]=membership_type&populate[]=customer&limit=200"
      );

      const memberships: Membership[] = Array.isArray(membershipsRaw)
        ? membershipsRaw
        : (membershipsRaw as { memberships?: Membership[] })?.memberships ?? [];

      const ptMemberships = memberships.filter((m) => isPTPlan(getPlan(m.membership_type?.name)));

      const grouped: Record<string, Membership[]> = {};
      for (const m of ptMemberships) {
        const plan = getPlan(m.membership_type?.name);
        if (!grouped[plan]) grouped[plan] = [];
        grouped[plan].push(m);
      }

      const ordered = PLAN_ORDER.filter((p) => isPTPlan(p) && grouped[p])
        .map((p) => ({ plan: p, memberships: grouped[p] }));

      if (grouped["Outros"]) ordered.push({ plan: "Outros", memberships: grouped["Outros"] });

      const rev = ordered.reduce((sum, g) => sum + g.memberships.length * (PLAN_VALUES[g.plan] || 0), 0);

      const upcomingPayments = ptMemberships
        .filter((m) => m.paid_until)
        .sort((a, b) => {
          const da = daysUntil(a.paid_until!) ?? 999;
          const db = daysUntil(b.paid_until!) ?? 999;
          return da - db;
        })
        .slice(0, 10);

      setPlanGroups(ordered);
      setTotalRevenue(rev);
      setUpcoming(upcomingPayments);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [fetchYogo, setLastFetch]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const totalPTs = planGroups.reduce((s, g) => s + g.memberships.length, 0);

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-red-500 text-sm">Erro: {error}</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Personal Trainers Ativos</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={<UsersIcon />}
          label="Total clientes PT"
          value={totalPTs}
          color="purple"
        />
        <StatCard
          icon={<EuroIcon />}
          label="Receita estimada"
          value={eur(totalRevenue)}
          color="emerald"
        />
      </div>

      <div className="space-y-6">
        {planGroups.map(({ plan, memberships }) => (
          <div key={plan} className="bg-zinc-800/40 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">{plan}</h2>
              <span className="text-zinc-400 text-sm">{memberships.length} cliente{memberships.length !== 1 ? "s" : ""} · {eur(memberships.length * (PLAN_VALUES[plan] || 0))}</span>
            </div>
            <div className="space-y-2">
              {memberships.map((m) => {
                const name = [m.customer?.first_name, m.customer?.last_name].filter(Boolean).join(" ") || "—";
                return (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-zinc-700/40 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-zinc-100">{name}</div>
                      <div className="text-xs text-zinc-500">{m.customer?.email || "—"}</div>
                    </div>
                    <PaymentBadge paidUntil={m.paid_until as string | null | undefined} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {upcoming.length > 0 && (
        <div className="bg-zinc-800/40 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">Próximos pagamentos</h2>
          <div className="space-y-2">
            {upcoming.map((m) => {
              const name = [m.customer?.first_name, m.customer?.last_name].filter(Boolean).join(" ") || "—";
              const plan = getPlan(m.membership_type?.name);
              return (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-zinc-700/40 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-zinc-100">{name}</div>
                    <div className="text-xs text-zinc-500">{plan}</div>
                  </div>
                  <PaymentBadge paidUntil={m.paid_until as string | null | undefined} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
