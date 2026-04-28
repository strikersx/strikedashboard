"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { Pill } from "@/components/pill";
import { LoaderIcon } from "@/components/icons";
import { getPlan } from "@/lib/utils";

interface Membership {
  id: number;
  status?: string;
  paid_until?: string;
  membership_type?: { name?: string };
  customer?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  [key: string]: unknown;
}

export default function FailedPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchYogo } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("status[]", "ended");
      params.append("is_payment_failed", "true");
      params.append("ended_because[]", "payment_failed");
      params.append("populate[]", "membership_type");
      params.append("populate[]", "customer");
      params.append("limit", "200");

      const raw = await fetchYogo("memberships-list?" + params.toString());
      const list: Membership[] = Array.isArray(raw)
        ? raw
        : (raw as { memberships?: Membership[] })?.memberships ?? [];

      setMemberships(list);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [fetchYogo, setLastFetch]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return <div className="py-20 flex justify-center"><LoaderIcon /></div>;
  if (error) return <div className="py-20 text-center text-red-500 text-sm">Erro: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Pagamentos falhados</h1>
          <p className="text-zinc-500 text-sm mt-1">Subscrições terminadas por falha de pagamento</p>
        </div>
        <span className="text-zinc-400 text-sm">{memberships.length} registo{memberships.length !== 1 ? "s" : ""}</span>
      </div>

      {memberships.length === 0 ? (
        <div className="py-12 text-center text-zinc-500">Nenhum pagamento falhado encontrado</div>
      ) : (
        <div className="space-y-2">
          {memberships.map((m) => {
            const name = [m.customer?.first_name, m.customer?.last_name].filter(Boolean).join(" ") || "—";
            const plan = getPlan(m.membership_type?.name);
            return (
              <div key={m.id} className="bg-zinc-800/40 rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-zinc-100">{name}</span>
                    <Pill color="red">pagamento falhado</Pill>
                  </div>
                  <div className="text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-0.5">
                    <span>{plan}</span>
                    {m.customer?.email && <span>{m.customer.email}</span>}
                    {m.customer?.phone && <span>{m.customer.phone}</span>}
                  </div>
                </div>
                {m.paid_until && (
                  <div className="text-xs text-zinc-500 shrink-0">
                    Até {String(m.paid_until).slice(0, 10)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
