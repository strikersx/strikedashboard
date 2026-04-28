"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { DataTable } from "@/components/data-table";
import { LoaderIcon } from "@/components/icons";
import { getLast30Days } from "@/lib/utils";
import { RECURRING_SUB_IDS } from "@/lib/constants";

interface Customer {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export default function ChurnPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getLast30Days();

      const customers = await fetchReport("reports/customers", {
        filters: [
          {
            type: "numberOfSignups",
            classTypeId: [],
            membershipTypeId: [],
            conditionType: "lessThanOrEquals",
            conditionAmount: 0,
            averagePerTimeUnit: "month",
            startDate,
            endDate,
            includeClassSignups: true,
            onlyCheckedInClassSignups: false,
            includeWaitingListSignups: false,
            includeLivestreamSignups: false,
            includeZeroSignups: false,
          },
          {
            type: "hasMembershipOrClassPass",
            membershipTypeId: RECURRING_SUB_IDS,
            classPassTypeId: [],
            onlyActiveMembershipsOrClassPasses: true,
          },
        ],
        returnColumnHeaders: true,
      });

      const formatted = (customers as Customer[]).map((c) => ({
        Nome: [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
        Email: c.email || "—",
        Telefone: c.phone || "—",
      }));

      setRows(formatted);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [fetchReport, setLastFetch]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-red-500 text-sm">Erro: {error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Risco de churn</h1>
        <p className="text-zinc-500 text-sm mt-1">Sem reservas nos últimos 30 dias</p>
      </div>
      <DataTable
        rows={rows}
        title="Membros em risco"
        empty="Nenhum membro em risco de churn"
      />
    </div>
  );
}
