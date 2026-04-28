"use client";

import { useEffect, useState, useCallback } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { LoaderIcon, CheckIcon, XIcon } from "@/components/icons";
import { Pill } from "@/components/pill";
import { TRIAL_CLASS_PASS_ID, TRIAL_CLASS_TYPE_ID } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";

interface Customer {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  attended?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button onClick={copy} className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition">
      {copied ? "copiado!" : "copiar"}
    </button>
  );
}

export default function TrialNoConvPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const today = fmtDate(new Date());
    const sixMonthsAgo = fmtDate(new Date(new Date().setMonth(new Date().getMonth() - 6)));

    Promise.all([
      fetchReport("reports/customers", {
        filters: [
          { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
          { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false },
        ],
        returnColumnHeaders: true,
      }),
      fetchReport("reports/customers", {
        filters: [
          { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
          { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false },
          { type: "numberOfSignups", classTypeId: [TRIAL_CLASS_TYPE_ID], membershipTypeId: [], conditionType: "greaterThanOrEquals", conditionAmount: 1, averagePerTimeUnit: "month", startDate: sixMonthsAgo, endDate: today, includeClassSignups: true, onlyCheckedInClassSignups: true, includeWaitingListSignups: false, includeLivestreamSignups: false, includeZeroSignups: false },
        ],
        returnColumnHeaders: true,
      }),
    ])
      .then(([trialAll, trialAttended]) => {
        const attendedIds = new Set(trialAttended.map((t: Record<string, unknown>) => t.id));
        const enriched = trialAll.map((t: Record<string, unknown>) => ({ ...t, attended: attendedIds.has(t.id) }));
        setRows(enriched as Customer[]);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => { setLoading(false); setLastFetch(new Date()); });
  }, [refreshKey, fetchReport, setLastFetch]);

  const copyAllPhones = useCallback((list: Customer[]) => {
    const phones = list.map((c) => c.phone).filter(Boolean).join("\n");
    navigator.clipboard.writeText(phones);
  }, []);

  if (loading) return <div className="py-12 text-center"><LoaderIcon /></div>;
  if (error) return <div className="py-12 text-center text-red-500 text-sm">Erro: {error}</div>;
  if (rows.length === 0) return <div className="py-12 text-center text-zinc-500">Nenhum trial pendente.</div>;

  const attended = rows.filter((r) => r.attended).sort((a, b) => (b.id || 0) - (a.id || 0));
  const noShow = rows.filter((r) => !r.attended).sort((a, b) => (b.id || 0) - (a.id || 0));

  const Card = ({ c, hot }: { c: Customer; hot?: boolean }) => (
    <div className={`bg-black/40 rounded-lg p-3 flex items-center justify-between gap-3 border-l-4 ${hot ? "border-pink-500" : "border-zinc-700"}`}>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{c.first_name} {c.last_name}</div>
        <div className="text-xs text-zinc-500 mt-0.5 flex flex-wrap items-center gap-x-3">
          {c.email && <span>{c.email}</span>}
          {c.phone && (
            <span className="flex items-center gap-1">
              <a href={`tel:${c.phone}`} className="text-blue-400 hover:underline font-mono">{c.phone}</a>
              <CopyButton text={c.phone} />
            </span>
          )}
        </div>
        {c.createdAt && <div className="text-xs text-zinc-600 mt-0.5">Cadastrado em {c.createdAt}</div>}
      </div>
      {hot ? <Pill color="pink"><CheckIcon /> foi à aula</Pill> : <Pill color="amber"><XIcon /> faltou / agendado</Pill>}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Aula experimental sem conversão <span className="text-zinc-500 font-normal">({rows.length})</span></h2>
        <button
          onClick={() => copyAllPhones(rows)}
          className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
        >
          Copiar todos os telefones
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-pink-950/30 border border-pink-900/50 rounded-lg p-4">
          <div className="text-pink-400 text-xs font-semibold uppercase tracking-wide mb-1">Foram à aula · {attended.length}</div>
          <div className="text-zinc-400 text-sm">Lead quente — fechar venda nas próximas 24-48h.</div>
        </div>
        <div className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-4">
          <div className="text-amber-400 text-xs font-semibold uppercase tracking-wide mb-1">Faltaram ou agendado · {noShow.length}</div>
          <div className="text-zinc-400 text-sm">Pode ser aula futura ou no-show — confirmar e reagendar se faltou.</div>
        </div>
      </div>
      {attended.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-pink-400 uppercase tracking-wide">Foram à aula ({attended.length})</h3>
            <button onClick={() => copyAllPhones(attended)} className="text-[10px] text-zinc-500 hover:text-zinc-300">copiar telefones</button>
          </div>
          <div className="space-y-1.5">{attended.map((c) => <Card key={c.id} c={c} hot />)}</div>
        </div>
      )}
      {noShow.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Faltaram ou aula ainda agendada ({noShow.length})</h3>
            <button onClick={() => copyAllPhones(noShow)} className="text-[10px] text-zinc-500 hover:text-zinc-300">copiar telefones</button>
          </div>
          <div className="space-y-1.5">{noShow.map((c) => <Card key={c.id} c={c} />)}</div>
        </div>
      )}
    </div>
  );
}
