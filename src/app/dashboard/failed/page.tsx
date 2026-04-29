"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { Pill } from "@/components/pill";
import { LoaderIcon } from "@/components/icons";
import { planColor, getPlan } from "@/lib/utils";
import type { ColorName } from "@/lib/constants";

interface Membership {
  id: number;
  user_full_name?: string;
  user_first_name?: string;
  user_last_name?: string;
  user_email?: string;
  user_phone?: string;
  membership_type_name?: string;
  status?: string;
  paid_until?: string;
  ended_because?: string;
  status_text?: string;
}

export default function FailedPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchReport("reports/memberships-list", {
        status: ["ended"],
        is_payment_failed: true,
        has_pending_no_show_fees: false,
        ended_because: ["payment_failed"],
      });
      setMemberships(raw as unknown as Membership[]);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="head text-xl font-bold">Pagamentos falhados</h1>
          <p className="text-muted text-sm mt-1">Subscrições terminadas por falha de pagamento</p>
        </div>
        <span className="text-muted-strong text-sm"><span className="num">{memberships.length}</span> registo{memberships.length !== 1 ? "s" : ""}</span>
      </div>

      {memberships.length === 0 ? (
        <div className="py-12 text-center text-muted">Nenhum pagamento falhado encontrado</div>
      ) : (
        <div className="space-y-2">
          {memberships.map((m) => {
            const name = m.user_full_name || [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || `Membership #${m.id}`;
            return (
              <div key={m.id} className="bg-surface rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">{name}</span>
                    <Pill color="red">pagamento falhado</Pill>
                  </div>
                  <div className="text-xs text-muted flex flex-wrap gap-x-4 gap-y-0.5">
                    {m.membership_type_name && <Pill color={planColor(getPlan(m.membership_type_name)) as ColorName}>{m.membership_type_name}</Pill>}
                    {m.user_email && <span>{m.user_email}</span>}
                    {m.user_phone && <span>{m.user_phone}</span>}
                  </div>
                </div>
                {m.paid_until && (
                  <div className="text-xs text-muted shrink-0">Até {m.paid_until}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
