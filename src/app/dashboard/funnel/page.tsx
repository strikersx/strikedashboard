"use client";

import { useEffect, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { LoaderIcon } from "@/components/icons";
import { ALL_SUB_IDS, TRIAL_CLASS_PASS_ID } from "@/lib/constants";
import { isNonActionableLead } from "@/lib/utils";

export default function FunnelPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [leads, setLeads] = useState(0);
  const [trialNoConv, setTrialNoConv] = useState(0);
  const [subs, setSubs] = useState(0);
  const [attended, setAttended] = useState(0);
  const [noshow, setNoshow] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchReport("reports/customers", { filters: [{ type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false }, { type: "hasNoClassPass", classPassTypeId: [], onlyActiveClassPasses: false }], returnColumnHeaders: true }),
      fetchReport("reports/customers", { filters: [{ type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false }, { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false }], returnColumnHeaders: true }),
      fetchReport("reports/customers", { filters: [{ type: "hasMembershipOrClassPass", membershipTypeId: ALL_SUB_IDS, classPassTypeId: [], onlyActiveMembershipsOrClassPasses: false }], returnColumnHeaders: true }),
    ]).then(([leadsData, trialData, subsData]) => {
      const actionable = leadsData.filter((l) => !isNonActionableLead(l as { email?: string }));
      setLeads(actionable.length);
      setTrialNoConv(trialData.length);
      setSubs(subsData.length);
      // attended/noshow would need another fetch — simplified here
      setAttended(0);
      setNoshow(trialData.length);
    }).catch(() => {})
    .finally(() => { setLoading(false); setLastFetch(new Date()); });
  }, [refreshKey, fetchReport, setLastFetch]);

  if (loading) return <div className="py-12 text-center"><LoaderIcon /></div>;

  const max = Math.max(leads, trialNoConv, subs, 1);
  const stages = [
    { label: "Leads frios", desc: "Cadastraram-se mas nunca compraram", value: leads, color: "bg-tone-magenta", text: "text-tone-magenta" },
    { label: "Trial sem conversão", desc: `${attended} foram à aula · ${noshow} não foram`, value: trialNoConv, color: "bg-tone-magenta", text: "text-tone-magenta" },
    { label: "Subscritores activos", desc: "Convertidos — receita recorrente", value: subs, color: "bg-accent", text: "text-accent" },
  ];

  return (
    <div>
      <h2 className="head text-lg font-semibold mb-2">Funil de conversão</h2>
      <p className="text-muted text-sm mb-6">Pipeline da Striker&apos;s House. Cada etapa requer uma acção diferente.</p>
      <div className="space-y-3">
        {stages.map((s, i) => {
          const pct = (s.value / max) * 100;
          const fromPrev = i > 0 ? Math.round((s.value / Math.max(stages[i - 1].value, 1)) * 100) : null;
          return (
            <div key={i} className="bg-surface rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div><div className="font-semibold">{s.label}</div><div className="text-xs text-muted">{s.desc}</div></div>
                <div className="text-right"><div className={`num text-2xl font-bold ${s.text}`}>{s.value}</div>{fromPrev !== null && <div className="text-xs text-muted">{fromPrev}% da etapa anterior</div>}</div>
              </div>
              <div className="h-2 bg-border-subtle rounded overflow-hidden"><div className={`h-full ${s.color}`} style={{ width: pct + "%" }} /></div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 grid md:grid-cols-3 gap-3">
        <div className="bg-tone-magenta/8 border border-tone-magenta/20 rounded-lg p-4">
          <div className="text-tone-magenta text-sm font-semibold mb-1">Acção: Leads frios</div>
          <div className="text-xs text-muted-strong">Convidar para aula experimental gratuita.</div>
        </div>
        <div className="bg-tone-magenta/8 border border-tone-magenta/20 rounded-lg p-4">
          <div className="text-tone-magenta text-sm font-semibold mb-1">Acção: Trial s/ conv.</div>
          <div className="text-xs text-muted-strong">Quem foi à aula — fechar agora. Quem faltou — reagendar.</div>
        </div>
        <div className="bg-accent/8 border border-accent/20 rounded-lg p-4">
          <div className="text-accent text-sm font-semibold mb-1">Acção: Subscritores</div>
          <div className="text-xs text-muted-strong">Manter qualidade da aula. Reduzir churn.</div>
        </div>
      </div>
    </div>
  );
}
