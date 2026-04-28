"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { DataTable } from "@/components/data-table";
import { LoaderIcon } from "@/components/icons";
import { isNonActionableLead } from "@/lib/utils";

interface Customer {
  id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  created_at?: string;
  [key: string]: unknown;
}

export default function LeadsPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchReport("reports/customers", {
        filters: [
          {
            type: "hasMembershipOrClassPass",
            membershipTypeId: [],
            classPassTypeId: [],
            onlyActiveMembershipsOrClassPasses: false,
            invertFilter: true,
          },
        ],
        returnColumnHeaders: true,
      });

      const actionable = (rows as Customer[]).filter((c) => !isNonActionableLead(c)).map((c) => ({
        Nome: [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
        Email: c.email || "—",
        Telefone: c.phone || "—",
        "Cadastrado em": c.created_at ? String(c.created_at).slice(0, 10) : "—",
      }));

      setLeads(actionable);
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
        <h1 className="text-xl font-bold">Leads frios accionáveis</h1>
        <p className="text-zinc-500 text-sm mt-1">Cadastraram-se mas nunca compraram</p>
      </div>
      <DataTable
        rows={leads}
        title="Leads"
        empty="Nenhum lead encontrado"
      />
    </div>
  );
}
