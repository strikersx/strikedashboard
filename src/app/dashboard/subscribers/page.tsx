"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { LoaderIcon } from "@/components/icons";
import { getPlan, eur } from "@/lib/utils";
import { ALL_SUB_IDS, PLAN_ORDER, PLAN_VALUES } from "@/lib/constants";
import { SubRow } from "@/components/sub-row";
import { type SubStatus } from "@/components/status-pill";

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
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "risk" | "failed">("all");

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

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-tone-coral text-sm">Erro: {error}</div>;

  // Derive flat list with status from paid_until
  const today = new Date().toISOString().slice(0, 10);
  type CustomerRow = Customer & { paid_until?: string; plan: string; daysLeft: number; status: SubStatus; paidUntil: string };
  const allCustomers: CustomerRow[] = planGroups.flatMap((g) =>
    g.customers.map((c): CustomerRow => {
      const paidUntil = c.paid_until ?? "";
      const daysLeft = paidUntil
        ? Math.round((new Date(paidUntil).getTime() - Date.now()) / 86400000)
        : 0;
      let status: SubStatus = "active";
      if (!paidUntil || paidUntil < today) status = "expired";
      else if (daysLeft <= 7) status = "risk";
      return { ...c, plan: g.plan, daysLeft, status, paidUntil };
    })
  );

  const filtered = (
    activeFilter === "all" ? allCustomers :
    activeFilter === "failed" ? allCustomers.filter((c) => c.status === "failed" || c.status === "expired") :
    allCustomers.filter((c) => c.status === activeFilter)
  ).slice().sort((a, b) => (b.paidUntil || "").localeCompare(a.paidUntil || ""));

  const filters = [
    { id: "all" as const,    label: "Todos",   count: allCustomers.length },
    { id: "active" as const, label: "Activos", count: allCustomers.filter((c) => c.status === "active").length },
    { id: "risk" as const,   label: "Risco",   count: allCustomers.filter((c) => c.status === "risk").length },
    { id: "failed" as const, label: "Falhas",  count: allCustomers.filter((c) => c.status === "failed" || c.status === "expired").length },
  ];

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Summary cards */}
      <div style={{ padding: "4px 18px 14px", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
        <div style={{ background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14 }}>
          <div className="head" style={{ fontSize: 10, color: "rgba(255,255,255,0.72)", marginBottom: 6 }}>SUBSCRITORES</div>
          <div className="num" style={{ fontSize: 38, color: "#fff" }}>{totalCount}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>activos · todos os planos</div>
        </div>
        <div style={{ background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14 }}>
          <div className="head" style={{ fontSize: 10, color: "rgba(255,255,255,0.72)", marginBottom: 6 }}>MRR ESTIMADO</div>
          <div className="num" style={{ fontSize: 38, color: "#00E5A0" }}>{eur(totalRevenue)}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>por mês · receita activa</div>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ padding: "0 18px 10px", display: "flex", gap: 6, overflowX: "auto" }} className="scrollbox">
        {filters.map((f) => {
          const isActive = activeFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              style={{
                flexShrink: 0, padding: "7px 12px", borderRadius: 999,
                background: isActive ? "#00E5A0" : "#0F0F14",
                color: isActive ? "#0a0a0a" : "rgba(255,255,255,0.72)",
                border: `1px solid ${isActive ? "#00E5A0" : "rgba(255,255,255,0.06)"}`,
                fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
                cursor: "pointer", fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
              className="tap"
            >
              {f.label}
              <span style={{ fontSize: 10, opacity: 0.7 }}>{f.count}</span>
            </button>
          );
        })}
      </div>

      {/* Subscriber list */}
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((c) => (
          <SubRow
            key={c.id}
            name={`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Sem nome"}
            plan={c.plan}
            detail={c.paidUntil ? `até ${c.paidUntil}` : "—"}
            status={c.status}
            daysUntilRenewal={c.daysLeft}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
            Nenhum subscritor nesta categoria.
          </div>
        )}
      </div>
    </div>
  );
}
