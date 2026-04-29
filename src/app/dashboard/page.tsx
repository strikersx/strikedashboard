"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/app/dashboard/layout";
import { useYogoFetch } from "@/hooks/use-yogo";
import { KPICard } from "@/components/kpi-card";
import { ActionRowHome } from "@/components/action-row-home";
import { Sparkline } from "@/components/sparkline";
import { TrendChip } from "@/components/trend-chip";
import {
  EuroIcon, UsersIcon, TrendIcon, CardIcon,
  ZapIcon, UserPlusIcon, TargetIcon, LoaderIcon,
} from "@/components/icons";
import {
  eur, isToday, isThisWeek, isThisMonth,
  getDashboardRange, getLast30Days, fmtDate,
  getPlan, isPTPlan, isNonActionableLead,
} from "@/lib/utils";
import { ALL_SUB_IDS, RECURRING_SUB_IDS, TRIAL_CLASS_TYPE_ID, TRIAL_CLASS_PASS_ID } from "@/lib/constants";

type Rec = Record<string, unknown>;

const REVENUE_QUERY = `
query revenueReport($input: RevenueReportInput!) {
  revenueReport(input: $input) {
    label startDate endDate
    items { itemType itemId itemCount name totalExVat vat totalInclVat vatPercentage eventStartDate }
  }
}`;

/** Group revenue items by month → cumulative running totals for sparkline */
function buildSparkData(revenueItems: Rec[]): number[] {
  const monthTotals: Record<string, number> = {};
  for (const period of revenueItems) {
    const items = (period.items || []) as Rec[];
    for (const item of items) {
      const date = String(item.eventStartDate || "");
      if (!date) continue;
      const key = date.slice(0, 7); // "2026-01"
      monthTotals[key] = (monthTotals[key] || 0) + Number(item.totalInclVat || 0);
    }
  }
  const months = Object.keys(monthTotals).sort();
  if (months.length === 0) return [];
  let cum = 0;
  return months.map((m) => { cum += monthTotals[m]; return cum; });
}

export default function DashboardPage() {
  const router = useRouter();
  const { role, isAdmin } = useAuth();
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchYogo, fetchReport, fetchGraphQL } = useYogoFetch();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subs, setSubs] = useState<Rec[]>([]);
  const [churn, setChurn] = useState<Rec[]>([]);
  const [failed, setFailed] = useState<Rec[]>([]);
  const [revenueItems, setRevenueItems] = useState<Rec[]>([]);
  const [leads, setLeads] = useState<Rec[]>([]);
  const [trialNoConv, setTrialNoConv] = useState<Rec[]>([]);
  const [trialAttended, setTrialAttended] = useState<Rec[]>([]);
  const [trialClasses, setTrialClasses] = useState<Rec[]>([]);
  const [allClasses, setAllClasses] = useState<Rec[]>([]);

  const classesUrl = useCallback((trialOnly: boolean) => {
    const { startDate, endDate } = getDashboardRange();
    const params = new URLSearchParams();
    params.set("startDate", startDate);
    params.set("endDate", endDate);
    for (const p of ["class_type","teachers","room","room.branch","signup_count","checked_in_count","waiting_list_count","waiting_list_max","livestream_signup_count","classpass_com_signup_count","bruce_app_signup_count","urban_sports_club_signup_count"]) {
      params.append("populate[]", p);
    }
    params.append("sort[]", "date ASC");
    params.append("sort[]", "start_time ASC");
    if (trialOnly) params.append("class_type[]", String(TRIAL_CLASS_TYPE_ID));
    return `classes?${params.toString()}`;
  }, []);

  const sixMonthsAgo = useCallback(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return fmtDate(d);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { startDate: last30Start, endDate: last30End } = getLast30Days();
        const today = fmtDate(new Date());
        const sixMAgo = sixMonthsAgo();

        const commonPromises = {
          leads: fetchReport("reports/customers", { filters: [{ type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false }, { type: "hasNoClassPass", classPassTypeId: [], onlyActiveClassPasses: false }], returnColumnHeaders: true }),
          trialNoConv: fetchReport("reports/customers", { filters: [{ type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false }, { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false }], returnColumnHeaders: true }),
          trialAttended: fetchReport("reports/customers", { filters: [{ type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false }, { type: "hasMembershipOrClassPass", membershipTypeId: [], classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveMembershipsOrClassPasses: false }, { type: "numberOfSignups", classTypeId: [TRIAL_CLASS_TYPE_ID], membershipTypeId: [], conditionType: "greaterThanOrEquals", conditionAmount: 1, averagePerTimeUnit: "month", startDate: sixMAgo, endDate: today, includeClassSignups: true, onlyCheckedInClassSignups: true, includeWaitingListSignups: false, includeLivestreamSignups: false, includeZeroSignups: false }], returnColumnHeaders: true }),
          trialClasses: fetchYogo(classesUrl(true)),
          allClasses: fetchYogo(classesUrl(false)),
        };

        const adminPromises = isAdmin ? {
          subs: fetchReport("reports/customers", { filters: [{ type: "hasMembershipOrClassPass", membershipTypeId: ALL_SUB_IDS, classPassTypeId: [], onlyActiveMembershipsOrClassPasses: false }], returnColumnHeaders: true }),
          churn: fetchReport("reports/customers", { filters: [{ type: "numberOfSignups", classTypeId: [], membershipTypeId: [], conditionType: "lessThanOrEquals", conditionAmount: 0, averagePerTimeUnit: "month", startDate: last30Start, endDate: last30End, includeClassSignups: true, onlyCheckedInClassSignups: false, includeWaitingListSignups: false, includeLivestreamSignups: false, includeZeroSignups: false }, { type: "hasMembershipOrClassPass", membershipTypeId: RECURRING_SUB_IDS, classPassTypeId: [], onlyActiveMembershipsOrClassPasses: true }], returnColumnHeaders: true }),
          failed: fetchReport("reports/memberships-list", { status: ["ended"], is_payment_failed: true, has_pending_no_show_fees: false, ended_because: ["payment_failed"] }),
          revenue: fetchGraphQL(REVENUE_QUERY, { input: { periodType: "year", startDate: `${new Date().getFullYear()}-01-01`, endDate: `${new Date().getFullYear()}-12-31`, dateFilterField: "paid", vatFilter: null, canHandleSeparateRefunds: true } }),
        } : {};

        const allKeys = { ...commonPromises, ...adminPromises };
        const entries = Object.entries(allKeys);
        const results = await Promise.all(entries.map(([, p]) => p));
        const data: Record<string, unknown> = {};
        entries.forEach(([k], i) => { data[k] = results[i]; });

        if (cancelled) return;

        setLeads(data.leads as Rec[]);
        setTrialNoConv(data.trialNoConv as Rec[]);
        setTrialAttended(data.trialAttended as Rec[]);
        const extractClasses = (d: unknown): Rec[] => Array.isArray(d) ? d : (d && typeof d === "object" && "classes" in d) ? (d as { classes: Rec[] }).classes : [];
        setTrialClasses(extractClasses(data.trialClasses));
        setAllClasses(extractClasses(data.allClasses));

        if (isAdmin) {
          setSubs(data.subs as Rec[]);
          setChurn(data.churn as Rec[]);
          setFailed(data.failed as Rec[]);
          const revData = data.revenue as { data?: { revenueReport?: Rec | Rec[] } };
          const report = revData?.data?.revenueReport;
          const reportItems = Array.isArray(report) ? report : report ? [report] : [];
          setRevenueItems(reportItems as Rec[]);
        }

        setLastFetch(new Date());
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey, isAdmin, fetchYogo, fetchReport, fetchGraphQL, classesUrl, sixMonthsAgo, setLastFetch]);

  /* ─── Derived state ─── */
  const ptCount = subs.filter((c) => isPTPlan(getPlan(String(c.has_membership_membership_description || "")))).length;
  const groupSubsCount = subs.length - ptCount;
  const churnPct = subs.length > 0 ? Math.round((churn.length / subs.length) * 100) : 0;
  const revenueTotal = revenueItems.reduce((sum, period) => {
    const items = (period.items || []) as Rec[];
    return sum + items.reduce((s, it) => s + (Number(it.totalInclVat) || 0), 0);
  }, 0);
  const monthsElapsed = new Date().getMonth() + 1;
  const avgMonth = monthsElapsed > 0 ? Math.round(revenueTotal / monthsElapsed) : 0;
  const sparkData = buildSparkData(revenueItems);

  const leadsActionable = leads.filter((l) => !isNonActionableLead(l as { email?: string }));
  const attendedIds = new Set(trialAttended.map((r) => String(r.id || r.customer_id)));
  const trialEnriched = trialNoConv.map((t) => ({ ...t, attended: attendedIds.has(String(t.id || t.customer_id)) })) as (Rec & { attended: boolean })[];
  const trialAttendedCount = trialEnriched.filter((t) => t.attended).length;
  const trialNoShowCount = trialEnriched.filter((t) => !t.attended).length;

  const trialClassesArr = Array.isArray(trialClasses) ? trialClasses : [];
  const trialWithSignups = trialClassesArr.filter((c) => Number(c.signup_count) > 0);
  const newTrialToday = trialWithSignups.filter((c) => isToday(String(c.date))).reduce((s, c) => s + Number(c.signup_count), 0);
  const newTrialWeek = trialWithSignups.filter((c) => isThisWeek(String(c.date))).reduce((s, c) => s + Number(c.signup_count), 0);
  const newTrialMonth = trialWithSignups.filter((c) => isThisMonth(String(c.date))).reduce((s, c) => s + Number(c.signup_count), 0);

  const allClassesArr = Array.isArray(allClasses) ? allClasses : [];
  const visitorSum = (c: Rec) => Number(c.urban_sports_club_signup_count || 0) + Number(c.classpass_com_signup_count || 0) + Number(c.bruce_app_signup_count || 0);
  const withVisitors = allClassesArr.filter((c) => visitorSum(c) > 0);
  const visitorsToday = withVisitors.filter((c) => isToday(String(c.date))).reduce((s, c) => s + visitorSum(c), 0);
  const visitorsWeek = withVisitors.filter((c) => isThisWeek(String(c.date))).reduce((s, c) => s + visitorSum(c), 0);
  const visitorsMonth = withVisitors.filter((c) => isThisMonth(String(c.date))).reduce((s, c) => s + visitorSum(c), 0);

  /* ─── Loading / Error ─── */
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <LoaderIcon />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "80px 18px" }}>
        <div style={{ color: "#FF3D2E", marginBottom: 8 }}>Erro ao carregar dados</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{error}</div>
      </div>
    );
  }

  /* ─── ADMIN VIEW ─── */
  if (isAdmin) {
    const actions = [
      failed.length > 0 && { count: failed.length, label: "pagamentos falhados", detail: "Cartões expirados ou recusados — recuperar receita ou cancelar", cta: "Contactar", tone: "#FF3D2E", href: "/dashboard/failed" },
      churn.length > 0 && { count: churn.length, label: "membros em risco de churn", detail: `0 aulas nos últimos 30 dias — risco de cancelamento`, cta: "Rever", tone: "#FFB627", href: "/dashboard/churn" },
      trialAttendedCount > 0 && { count: trialAttendedCount, label: "trials que foram à aula", detail: "Lead quente — fechar venda nas próximas 24-48h", cta: "Follow-up", tone: "#FF2E88", href: "/dashboard/trials" },
      trialNoShowCount > 0 && { count: trialNoShowCount, label: "trials que faltaram", detail: "Pode ser no-show — confirmar e reagendar", cta: "Reagendar", tone: "#00E5A0", href: "/dashboard/trials" },
      leadsActionable.length > 0 && { count: leadsActionable.length, label: "leads sem contacto há 7d", detail: "Reactivar conversação antes que esfriem", cta: "WhatsApp", tone: "#A6E22E", href: "/dashboard/leads" },
    ].filter(Boolean) as { count: number; label: string; detail: string; cta: string; tone: string; href: string }[];

    return (
      <div style={{ paddingBottom: 32 }}>
        {/* ── Hero: Receita YTD ── */}
        <div style={{ padding: "4px 18px 14px" }}>
          <div style={{
            background: "linear-gradient(135deg, #0F0F14 0%, #12121A 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 18,
            padding: 18,
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Glow */}
            <div style={{
              position: "absolute", right: -20, top: -20, width: 140, height: 140,
              background: "radial-gradient(circle, rgba(0,229,160,0.2) 0%, transparent 70%)",
              borderRadius: "50%",
            }} />
            <div style={{ position: "relative" }}>
              <div className="head" style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", marginBottom: 8 }}>
                Receita YTD
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 10 }}>
                <div className="num" style={{ fontSize: 56, color: "#fff", lineHeight: 0.85 }}>
                  {eur(revenueTotal)}
                </div>
                <TrendChip dir="up" value={`Média ${eur(avgMonth)}/mês`} />
              </div>
              <Sparkline data={sparkData} accent="#00E5A0" height={56} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                  Jan {new Date().getFullYear().toString().slice(2)}
                </span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Média {eur(avgMonth)}/mês</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Hoje</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI grid ── */}
        <SectionHead title="Indicadores" action="ver todos" onAction={() => router.push("/dashboard/more")} />
        <div style={{ padding: "0 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* KPICard.icon color is set by the card's icon-box via color:tone — pass icons without style prop */}
          <KPICard icon={<UsersIcon className="w-3.5 h-3.5" />} label="Subscrições activas" value={subs.length} sub={`${groupSubsCount} grupo · ${ptCount} PT`} tone="#3D7DFF" trendDir="up" trendValue={`+${subs.length}`} onClick={() => router.push("/dashboard/subscribers")} />
          <KPICard icon={<TrendIcon className="w-3.5 h-3.5" />} label="Churn (30d)" value={churn.length} sub={`${churnPct}% — sem aulas em 30d`} tone="#FFB627" trendDir={churnPct > 10 ? "down" : "flat"} trendValue={`${churnPct}%`} onClick={() => router.push("/dashboard/churn")} />
          <KPICard icon={<CardIcon className="w-3.5 h-3.5" />} label="Pagamentos falhados" value={failed.length} sub="Memberships ended" tone="#FF3D2E" trendDir={failed.length > 0 ? "down" : "flat"} trendValue={`${failed.length}`} onClick={() => router.push("/dashboard/failed")} />
          <KPICard icon={<UserPlusIcon className="w-3.5 h-3.5" />} label="Leads" value={leadsActionable.length} sub={`${leads.length - leadsActionable.length} não accionáveis`} tone="#A6E22E" trendDir="up" trendValue={`+${leadsActionable.length}`} onClick={() => router.push("/dashboard/leads")} />
          <KPICard icon={<TargetIcon className="w-3.5 h-3.5" />} label="Trials s/ conv." value={trialEnriched.length} sub={`${trialAttendedCount} foram · ${trialNoShowCount} faltaram`} tone="#FF2E88" trendDir={trialEnriched.length > 0 ? "down" : "flat"} trendValue={`${trialEnriched.length}`} onClick={() => router.push("/dashboard/trials")} />
          <KPICard icon={<ZapIcon className="w-3.5 h-3.5" />} label="Novos trials" value={newTrialToday} sub={`Semana ${newTrialWeek} · Mês ${newTrialMonth}`} tone="#00E5A0" trendDir={newTrialToday > 0 ? "up" : "flat"} trendValue={`${newTrialMonth} mês`} onClick={() => router.push("/dashboard/classes")} />
          <KPICard icon={<UsersIcon className="w-3.5 h-3.5" />} label="Visitantes" value={visitorsToday} sub={`Semana ${visitorsWeek} · Mês ${visitorsMonth}`} tone="#3D7DFF" trendDir={visitorsToday > 0 ? "up" : "flat"} trendValue={`${visitorsMonth} mês`} onClick={() => router.push("/dashboard/classes")} />
        </div>

        {/* ── Action rows ── */}
        <SectionHead title="Acções recomendadas" count={actions.length} />
        <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          {actions.length === 0 && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
              Tudo em ordem — sem acções pendentes.
            </div>
          )}
          {actions.map((a) => (
            <ActionRowHome
              key={a.href + a.label}
              count={a.count}
              label={a.label}
              detail={a.detail}
              cta={a.cta}
              tone={a.tone}
              onClick={() => router.push(a.href)}
              onCta={() => router.push(a.href)}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ─── SALES VIEW ─── */
  return (
    <div style={{ paddingBottom: 32 }}>
      <SectionHead title="Funil de Conversão" />
      <div style={{ padding: "0 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <KPICard icon={<UserPlusIcon className="w-3.5 h-3.5" />} label="Leads" value={leadsActionable.length} sub={`${leads.length - leadsActionable.length} filtrados`} tone="#A6E22E" trendDir="up" trendValue={`+${leadsActionable.length}`} onClick={() => router.push("/dashboard/leads")} />
        <KPICard icon={<TargetIcon className="w-3.5 h-3.5" />} label="Trials s/ conv." value={trialEnriched.length} sub={`${trialAttendedCount} foram · ${trialNoShowCount} faltaram`} tone="#FF2E88" trendDir="down" trendValue={`${trialEnriched.length}`} onClick={() => router.push("/dashboard/trials")} />
        <KPICard icon={<ZapIcon className="w-3.5 h-3.5" />} label="Novos trials" value={newTrialToday} sub={`Semana ${newTrialWeek} · Mês ${newTrialMonth}`} tone="#00E5A0" trendDir={newTrialToday > 0 ? "up" : "flat"} trendValue={`${newTrialMonth} mês`} onClick={() => router.push("/dashboard/classes")} />
        <KPICard icon={<UsersIcon className="w-3.5 h-3.5" />} label="Visitantes" value={visitorsToday} sub={`Semana ${visitorsWeek} · Mês ${visitorsMonth}`} tone="#3D7DFF" trendDir={visitorsToday > 0 ? "up" : "flat"} trendValue={`${visitorsMonth} mês`} onClick={() => router.push("/dashboard/classes")} />
      </div>

      <SectionHead title="Acções recomendadas" count={trialAttendedCount + trialNoShowCount + leadsActionable.length} />
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        {trialAttendedCount > 0 && <ActionRowHome count={trialAttendedCount} label="trials que foram à aula" detail="Lead quente — fechar venda nas próximas 24-48h" cta="Follow-up" tone="#FF2E88" onClick={() => router.push("/dashboard/trials")} onCta={() => router.push("/dashboard/trials")} />}
        {trialNoShowCount > 0 && <ActionRowHome count={trialNoShowCount} label="trials que faltaram" detail="Confirmar e reagendar" cta="Reagendar" tone="#00E5A0" onClick={() => router.push("/dashboard/trials")} onCta={() => router.push("/dashboard/trials")} />}
        {leadsActionable.length > 0 && <ActionRowHome count={leadsActionable.length} label="leads sem contacto há 7d" detail="Reactivar conversação antes que esfriem" cta="WhatsApp" tone="#A6E22E" onClick={() => router.push("/dashboard/leads")} onCta={() => router.push("/dashboard/leads")} />}
      </div>
    </div>
  );
}

/* ── SectionHead ── */
function SectionHead({ title, count, action, onAction }: { title: string; count?: number; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "18px 18px 10px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>{title}</h3>
        {count != null && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{count}</span>}
      </div>
      {action && (
        <button onClick={onAction} style={{ background: "transparent", border: "none", color: "#00E5A0", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: 0, fontFamily: "inherit" }} className="tap">
          {action} ›
        </button>
      )}
    </div>
  );
}
