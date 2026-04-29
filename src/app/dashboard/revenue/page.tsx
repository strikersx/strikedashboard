"use client";

import { useEffect, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { MiniStat } from "@/components/mini-stat";
import { BarChart } from "@/components/bar-chart";
import { LoaderIcon } from "@/components/icons";
import { eur, monthLabel } from "@/lib/utils";
import { ALL_SUB_IDS } from "@/lib/constants";

interface RevenueItem {
  itemType: string;
  itemId: number;
  itemCount: number;
  name: string;
  totalExVat: number;
  vat: number;
  totalInclVat: number;
  vatPercentage: number;
  eventStartDate: string | null;
}

export default function RevenuePage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchGraphQL } = useYogoFetch();
  const [report, setReport] = useState<{ items: RevenueItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const year = new Date().getFullYear();
    setLoading(true);
    fetchGraphQL(
      `query revenueReport($input: RevenueReportInput!) { revenueReport(input: $input) { label startDate endDate items { itemType itemId itemCount name totalExVat vat totalInclVat vatPercentage eventStartDate } } }`,
      { input: { periodType: "year", startDate: `${year}-01-01`, endDate: `${year}-12-31`, dateFilterField: "paid", vatFilter: null, canHandleSeparateRefunds: true } }
    )
      .then((json) => {
        const r = Array.isArray(json.data?.revenueReport) ? json.data.revenueReport[0] : json.data?.revenueReport;
        setReport(r);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => { setLoading(false); setLastFetch(new Date()); });
  }, [refreshKey, fetchGraphQL, setLastFetch]);

  if (loading) return <div className="py-12 text-center"><LoaderIcon /></div>;
  if (error) return <div className="py-12 text-center text-tone-coral text-sm">Erro: {error}</div>;
  if (!report) return <div className="py-12 text-center text-muted">Sem dados de faturação</div>;

  const items = report.items || [];
  const revenueTotal = items.reduce((s, i) => s + (i.totalInclVat || 0), 0);
  const revenueExVat = items.reduce((s, i) => s + (i.totalExVat || 0), 0);
  const revenueVat = items.reduce((s, i) => s + (i.vat || 0), 0);
  const monthsElapsed = Math.max(1, new Date().getMonth() + 1);
  const avgMonth = revenueTotal / monthsElapsed;

  const subItems = items.filter((i) => ALL_SUB_IDS.includes(i.itemId));
  const subCount = subItems.reduce((s, i) => s + (i.itemCount || 0), 0);
  const subRevenue = subItems.reduce((s, i) => s + (i.totalInclVat || 0), 0);
  const ticketMedio = subCount > 0 ? subRevenue / subCount : 0;

  const byMonth: Record<number, number> = {};
  items.forEach((i) => { if (!i.eventStartDate) return; const m = new Date(i.eventStartDate).getMonth(); byMonth[m] = (byMonth[m] || 0) + (i.totalInclVat || 0); });
  const monthly = Array.from({ length: 12 }, (_, m) => ({ label: monthLabel(m), value: Math.round(byMonth[m] || 0) }));
  const currentMonth = new Date().getMonth();

  const byName: Record<string, { name: string; type: string; count: number; total: number }> = {};
  items.forEach((i) => { const k = i.name || `(${i.itemType})`; if (!byName[k]) byName[k] = { name: k, type: i.itemType, count: 0, total: 0 }; byName[k].count += i.itemCount || 1; byName[k].total += i.totalInclVat || 0; });
  const topItems = Object.values(byName).sort((a, b) => b.total - a.total);

  const byType: Record<string, number> = {};
  items.forEach((i) => { const k = i.itemType || "unknown"; byType[k] = (byType[k] || 0) + (i.totalInclVat || 0); });
  const typeBreakdown = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="head text-lg font-semibold">Faturação {new Date().getFullYear()}</h2>
        <span className="text-muted text-xs">{items.length} transacções</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MiniStat label="Total c/ IVA" value={eur(revenueTotal)} color="emerald" />
        <MiniStat label="Total s/ IVA" value={eur(revenueExVat)} />
        <MiniStat label="Ticket médio" value={eur(ticketMedio)} color="emerald" />
        <MiniStat label="Média mensal" value={eur(avgMonth)} color="emerald" />
      </div>
      <div className="bg-surface rounded-lg p-4 mb-6">
        <h3 className="head text-sm font-semibold text-muted-strong mb-4">Faturação mensal</h3>
        <BarChart data={monthly} currentIdx={currentMonth} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-surface rounded-lg p-4">
          <h3 className="head text-sm font-semibold text-muted-strong mb-3">Top items por faturação</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {topItems.slice(0, 15).map((item, i) => {
              const pct = (item.total / revenueTotal) * 100;
              return (
                <div key={i} className="text-sm">
                  <div className="flex justify-between mb-1"><span className="truncate pr-2">{item.name}</span><span className="num text-accent font-medium flex-shrink-0">{eur(item.total)}</span></div>
                  <div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-border-subtle rounded overflow-hidden"><div className="h-full bg-accent" style={{ width: Math.min(100, pct) + "%" }} /></div><span className="text-xs text-muted flex-shrink-0">{item.count}× · {pct.toFixed(1)}%</span></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-surface rounded-lg p-4">
          <h3 className="head text-sm font-semibold text-muted-strong mb-3">Por tipo de item</h3>
          <div className="space-y-2">
            {typeBreakdown.map(([type, amount]) => {
              const pct = (amount / revenueTotal) * 100;
              return (
                <div key={type} className="text-sm">
                  <div className="flex justify-between mb-1"><span className="capitalize">{type.replace(/_/g, " ")}</span><span className="num text-accent font-medium">{eur(amount)}</span></div>
                  <div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-border-subtle rounded overflow-hidden"><div className="h-full bg-tone-blue" style={{ width: Math.min(100, pct) + "%" }} /></div><span className="text-xs text-muted flex-shrink-0">{pct.toFixed(1)}%</span></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
