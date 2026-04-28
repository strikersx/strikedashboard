"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/app/dashboard/layout";
import { useYogoFetch } from "@/hooks/use-yogo";
import { StatCard } from "@/components/stat-card";
import { MiniStat } from "@/components/mini-stat";
import { Pill } from "@/components/pill";
import {
  EuroIcon,
  UsersIcon,
  TrendIcon,
  CardIcon,
  ZapIcon,
  UserPlusIcon,
  TargetIcon,
  CheckIcon,
  XIcon,
  LoaderIcon,
} from "@/components/icons";
import {
  eur,
  isToday,
  isThisWeek,
  isThisMonth,
  getDashboardRange,
  getLast30Days,
  fmtDate,
  getPlan,
  isPTPlan,
  isNonActionableLead,
} from "@/lib/utils";
import {
  ALL_SUB_IDS,
  RECURRING_SUB_IDS,
  TRIAL_CLASS_TYPE_ID,
  TRIAL_CLASS_PASS_ID,
} from "@/lib/constants";

/* ─── Types ─── */
type Rec = Record<string, unknown>;

/* ─── Revenue GraphQL query ─── */
const REVENUE_QUERY = `
query revenueReport($input: RevenueReportInput!) {
  revenueReport(input: $input) {
    label startDate endDate
    items { itemType itemId itemCount name totalExVat vat totalInclVat vatPercentage eventStartDate }
  }
}`;

export default function DashboardPage() {
  const router = useRouter();
  const { role, isAdmin } = useAuth();
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchYogo, fetchReport, fetchGraphQL } = useYogoFetch();

  /* ─── State ─── */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin KPI data
  const [subs, setSubs] = useState<Rec[]>([]);
  const [memberships, setMemberships] = useState<Rec[]>([]);
  const [churn, setChurn] = useState<Rec[]>([]);
  const [failed, setFailed] = useState<Rec[]>([]);
  const [revenueItems, setRevenueItems] = useState<Rec[]>([]);

  // Shared data (admin + sales)
  const [leads, setLeads] = useState<Rec[]>([]);
  const [trialNoConv, setTrialNoConv] = useState<Rec[]>([]);
  const [trialAttended, setTrialAttended] = useState<Rec[]>([]);
  const [trialClasses, setTrialClasses] = useState<Rec[]>([]);
  const [allClasses, setAllClasses] = useState<Rec[]>([]);

  /* ─── Helpers ─── */
  const classesUrl = useCallback(
    (trialOnly: boolean) => {
      const { startDate, endDate } = getDashboardRange();
      const params = new URLSearchParams();
      params.set("startDate", startDate);
      params.set("endDate", endDate);
      for (const p of [
        "class_type",
        "teachers",
        "room",
        "room.branch",
        "signup_count",
        "checked_in_count",
        "waiting_list_count",
        "waiting_list_max",
        "livestream_signup_count",
        "classpass_com_signup_count",
        "bruce_app_signup_count",
        "urban_sports_club_signup_count",
      ]) {
        params.append("populate[]", p);
      }
      params.append("sort[]", "date ASC");
      params.append("sort[]", "start_time ASC");
      if (trialOnly) params.append("class_type[]", String(TRIAL_CLASS_TYPE_ID));
      return `classes?${params.toString()}`;
    },
    []
  );

  const sixMonthsAgo = useCallback(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return fmtDate(d);
  }, []);

  /* ─── Fetch all data ─── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { startDate: last30Start, endDate: last30End } = getLast30Days();
        const today = fmtDate(new Date());
        const sixMAgo = sixMonthsAgo();

        // Common fetches (both admin and sales)
        const commonPromises = {
          leads: fetchReport("reports/customers", {
            filters: [
              { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
              { type: "hasNoClassPass", classPassTypeId: [], onlyActiveClassPasses: false },
            ],
            returnColumnHeaders: true,
          }),
          trialNoConv: fetchReport("reports/customers", {
            filters: [
              { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
              {
                type: "hasMembershipOrClassPass",
                membershipTypeId: [],
                classPassTypeId: [TRIAL_CLASS_PASS_ID],
                onlyActiveMembershipsOrClassPasses: false,
              },
            ],
            returnColumnHeaders: true,
          }),
          trialAttended: fetchReport("reports/customers", {
            filters: [
              { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
              {
                type: "hasMembershipOrClassPass",
                membershipTypeId: [],
                classPassTypeId: [TRIAL_CLASS_PASS_ID],
                onlyActiveMembershipsOrClassPasses: false,
              },
              {
                type: "numberOfSignups",
                classTypeId: [TRIAL_CLASS_TYPE_ID],
                membershipTypeId: [],
                conditionType: "greaterThanOrEquals",
                conditionAmount: 1,
                averagePerTimeUnit: "month",
                startDate: sixMAgo,
                endDate: today,
                includeClassSignups: true,
                onlyCheckedInClassSignups: true,
                includeWaitingListSignups: false,
                includeLivestreamSignups: false,
                includeZeroSignups: false,
              },
            ],
            returnColumnHeaders: true,
          }),
          trialClasses: fetchYogo(classesUrl(true)),
          allClasses: fetchYogo(classesUrl(false)),
        };

        // Admin-only fetches
        const adminPromises = isAdmin
          ? {
              subs: fetchReport("reports/customers", {
                filters: [
                  {
                    type: "hasMembershipOrClassPass",
                    membershipTypeId: ALL_SUB_IDS,
                    classPassTypeId: [],
                    onlyActiveMembershipsOrClassPasses: false,
                  },
                ],
                returnColumnHeaders: true,
              }),
              memberships: fetchReport("reports/memberships-list", { status: ["active"] }),
              churn: fetchReport("reports/customers", {
                filters: [
                  {
                    type: "numberOfSignups",
                    classTypeId: [],
                    membershipTypeId: [],
                    conditionType: "lessThanOrEquals",
                    conditionAmount: 0,
                    averagePerTimeUnit: "month",
                    startDate: last30Start,
                    endDate: last30End,
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
              }),
              failed: fetchReport("reports/memberships-list", {
                status: ["ended"],
                is_payment_failed: true,
                has_pending_no_show_fees: false,
                ended_because: ["payment_failed"],
              }),
              revenue: fetchGraphQL(REVENUE_QUERY, {
                input: {
                  periodType: "year",
                  startDate: `${new Date().getFullYear()}-01-01`,
                  endDate: `${new Date().getFullYear()}-12-31`,
                  dateFilterField: "paid",
                  vatFilter: null,
                  canHandleSeparateRefunds: true,
                },
              }),
            }
          : {};

        // Await all in parallel
        const allKeys = { ...commonPromises, ...adminPromises };
        const entries = Object.entries(allKeys);
        const results = await Promise.all(entries.map(([, p]) => p));
        const data: Record<string, unknown> = {};
        entries.forEach(([k], i) => {
          data[k] = results[i];
        });

        if (cancelled) return;

        // Set shared state
        setLeads(data.leads as Rec[]);
        setTrialNoConv(data.trialNoConv as Rec[]);
        setTrialAttended(data.trialAttended as Rec[]);
        setTrialClasses(Array.isArray(data.trialClasses) ? (data.trialClasses as Rec[]) : []);
        setAllClasses(Array.isArray(data.allClasses) ? (data.allClasses as Rec[]) : []);

        // Set admin state
        if (isAdmin) {
          setSubs(data.subs as Rec[]);
          setMemberships(data.memberships as Rec[]);
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
    return () => {
      cancelled = true;
    };
  }, [refreshKey, isAdmin, fetchYogo, fetchReport, fetchGraphQL, classesUrl, sixMonthsAgo, setLastFetch]);

  /* ─── Derived state: Admin KPIs ─── */
  // subs = customers from /reports/customers (all with any subscription)
  const subsCount = subs.length;

  const ptCount = subs.filter((c) => {
    const plan = getPlan(String(c.has_membership_membership_description || ""));
    return isPTPlan(plan);
  }).length;
  const groupSubsCount = subsCount - ptCount;

  const churnCount = churn.length;
  const churnPct = subsCount > 0 ? Math.round((churnCount / subsCount) * 100) : 0;

  const failedCount = failed.length;

  // Revenue
  const revenueTotal = revenueItems.reduce((sum, period) => {
    const items = (period.items || []) as Rec[];
    return sum + items.reduce((s, it) => s + (Number(it.totalInclVat) || 0), 0);
  }, 0);
  const monthsElapsed = new Date().getMonth() + 1;
  const avgMonth = monthsElapsed > 0 ? Math.round(revenueTotal / monthsElapsed) : 0;

  /* ─── Derived state: Funnel / Sales KPIs ─── */
  const leadsActionable = leads.filter((l) => !isNonActionableLead(l as { email?: string }));

  const attendedIds = new Set(trialAttended.map((r) => String(r.id || r.customer_id)));
  const trialEnriched = trialNoConv.map((t) => ({
    ...t,
    attended: attendedIds.has(String(t.id || t.customer_id)),
  })) as (Rec & { attended: boolean })[];
  const trialAttendedCount = trialEnriched.filter((t) => t.attended).length;
  const trialNoShowCount = trialEnriched.filter((t) => !t.attended).length;

  // Trial classes — signups by period
  const trialClassesArr = Array.isArray(trialClasses) ? trialClasses : [];
  const trialWithSignups = trialClassesArr.filter((c) => Number(c.signup_count) > 0);
  const newTrialToday = trialWithSignups.filter((c) => isToday(String(c.date))).reduce((s, c) => s + Number(c.signup_count), 0);
  const newTrialWeek = trialWithSignups.filter((c) => isThisWeek(String(c.date))).reduce((s, c) => s + Number(c.signup_count), 0);
  const newTrialMonth = trialWithSignups.filter((c) => isThisMonth(String(c.date))).reduce((s, c) => s + Number(c.signup_count), 0);

  // Visitors (USC / ClassPass / Bruce signups)
  const allClassesArr = Array.isArray(allClasses) ? allClasses : [];
  const withVisitors = allClassesArr.filter(
    (c) =>
      Number(c.urban_sports_club_signup_count) > 0 ||
      Number(c.classpass_com_signup_count) > 0 ||
      Number(c.bruce_app_signup_count) > 0
  );
  const visitorSum = (c: Rec) =>
    Number(c.urban_sports_club_signup_count || 0) +
    Number(c.classpass_com_signup_count || 0) +
    Number(c.bruce_app_signup_count || 0);
  const visitorsToday = withVisitors.filter((c) => isToday(String(c.date))).reduce((s, c) => s + visitorSum(c), 0);
  const visitorsWeek = withVisitors.filter((c) => isThisWeek(String(c.date))).reduce((s, c) => s + visitorSum(c), 0);
  const visitorsMonth = withVisitors.filter((c) => isThisMonth(String(c.date))).reduce((s, c) => s + visitorSum(c), 0);

  /* ─── Loading / Error ─── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoaderIcon className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-red-500 mb-2">Erro ao carregar dados</div>
        <div className="text-zinc-500 text-sm">{error}</div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     ADMIN VIEW
  ═══════════════════════════════════════════════════════════════ */
  if (isAdmin) {
    return (
      <div className="space-y-6">
        {/* Row 1 — Core KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<EuroIcon />}
            label="Receita YTD"
            value={eur(revenueTotal)}
            sublabel={`Média ${eur(avgMonth)}/mês`}
            color="emerald"
            onClick={() => router.push("/dashboard/revenue")}
          />
          <StatCard
            icon={<UsersIcon />}
            label="Subscrições ativas"
            value={subsCount}
            sublabel={`${groupSubsCount} grupo · ${ptCount} PT`}
            color="blue"
            onClick={() => router.push("/dashboard/subscribers")}
          />
          <StatCard
            icon={<TrendIcon />}
            label="Churn (30d)"
            value={`${churnCount} (${churnPct}%)`}
            sublabel="Sem aulas nos últimos 30 dias"
            color="amber"
            onClick={() => router.push("/dashboard/churn")}
          />
          <StatCard
            icon={<CardIcon />}
            label="Pagamentos falhados"
            value={failedCount}
            sublabel="Memberships ended"
            color="red"
            onClick={() => router.push("/dashboard/failed")}
          />
        </div>

        {/* Row 2 — Funnel KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<UserPlusIcon />}
            label="Leads"
            value={leadsActionable.length}
            sublabel={`${leads.length - leadsActionable.length} não acionáveis filtrados`}
            color="purple"
            onClick={() => router.push("/dashboard/leads")}
          />
          <StatCard
            icon={<TargetIcon />}
            label="Trials sem conversão"
            value={trialEnriched.length}
            sublabel={`${trialAttendedCount} foram · ${trialNoShowCount} faltaram`}
            color="pink"
            onClick={() => router.push("/dashboard/trials")}
          />
          <StatCard
            icon={<ZapIcon />}
            label="Novos trials"
            value={newTrialToday}
            sublabel={`Semana: ${newTrialWeek} · Mês: ${newTrialMonth}`}
            color="cyan"
            onClick={() => router.push("/dashboard/classes")}
          />
          <StatCard
            icon={<UsersIcon />}
            label="Visitantes"
            value={visitorsToday}
            sublabel={`Semana: ${visitorsWeek} · Mês: ${visitorsMonth}`}
            color="blue"
            onClick={() => router.push("/dashboard/classes")}
          />
        </div>

        {/* Overview — Recommended actions */}
        <div className="border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Ações recomendadas</h2>
          <div className="space-y-3">
            {failedCount > 0 && (
              <ActionRow
                color="red"
                label={`${failedCount} pagamentos falhados — contactar ou cancelar`}
                onClick={() => router.push("/dashboard/failed")}
              />
            )}
            {churnCount > 0 && (
              <ActionRow
                color="amber"
                label={`${churnCount} membros em risco de churn (0 aulas em 30 dias)`}
                onClick={() => router.push("/dashboard/churn")}
              />
            )}
            {trialAttendedCount > 0 && (
              <ActionRow
                color="pink"
                label={`${trialAttendedCount} trials que foram à aula — follow up para conversão`}
                onClick={() => router.push("/dashboard/trials")}
              />
            )}
            {trialNoShowCount > 0 && (
              <ActionRow
                color="purple"
                label={`${trialNoShowCount} trials que faltaram — reagendar`}
                onClick={() => router.push("/dashboard/trials")}
              />
            )}
            {leadsActionable.length > 0 && (
              <ActionRow
                color="blue"
                label={`${leadsActionable.length} leads frios para contactar`}
                onClick={() => router.push("/dashboard/leads")}
              />
            )}
            {failedCount === 0 &&
              churnCount === 0 &&
              trialAttendedCount === 0 &&
              trialNoShowCount === 0 &&
              leadsActionable.length === 0 && (
                <div className="text-zinc-500 text-sm py-2">Tudo em ordem — sem ações pendentes.</div>
              )}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     SALES VIEW
  ═══════════════════════════════════════════════════════════════ */
  const trialsWentToClass = trialEnriched.filter((t) => t.attended);
  const trialsMissed = trialEnriched.filter((t) => !t.attended);

  return (
    <div className="space-y-6">
      {/* Funnel KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<UserPlusIcon />}
          label="Leads"
          value={leadsActionable.length}
          sublabel={`${leads.length - leadsActionable.length} filtrados`}
          color="purple"
          onClick={() => router.push("/dashboard/leads")}
        />
        <StatCard
          icon={<TargetIcon />}
          label="Trials sem conversão"
          value={trialEnriched.length}
          sublabel={`${trialAttendedCount} foram · ${trialNoShowCount} faltaram`}
          color="pink"
          onClick={() => router.push("/dashboard/trials")}
        />
        <StatCard
          icon={<ZapIcon />}
          label="Novos trials"
          value={newTrialToday}
          sublabel={`Semana: ${newTrialWeek} · Mês: ${newTrialMonth}`}
          color="cyan"
          onClick={() => router.push("/dashboard/classes")}
        />
        <StatCard
          icon={<UsersIcon />}
          label="Visitantes"
          value={visitorsToday}
          sublabel={`Semana: ${visitorsWeek} · Mês: ${visitorsMonth}`}
          color="blue"
          onClick={() => router.push("/dashboard/classes")}
        />
      </div>

      {/* Mini stats row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <MiniStat label="Trials hoje" value={newTrialToday} color="cyan" />
        <MiniStat label="Trials semana" value={newTrialWeek} color="cyan" />
        <MiniStat label="Trials mês" value={newTrialMonth} color="cyan" />
        <MiniStat label="Visitantes hoje" value={visitorsToday} color="blue" />
        <MiniStat label="Visitantes semana" value={visitorsWeek} color="blue" />
        <MiniStat label="Visitantes mês" value={visitorsMonth} color="blue" />
      </div>

      {/* Priority 1: Trials que foram à aula */}
      <SalesSection
        title="Prioridade 1: Trials que foram à aula"
        borderColor="border-pink-600"
        count={trialsWentToClass.length}
        emptyText="Nenhum trial que foi à aula pendente."
      >
        {trialsWentToClass.slice(0, 10).map((t, i) => (
          <LeadRow
            key={String(t.id || t.customer_id || i)}
            name={`${t.first_name || ""} ${t.last_name || ""}`.trim() || "Sem nome"}
            email={String(t.email || "")}
            pill={<Pill color="pink"><CheckIcon /> Foi à aula</Pill>}
          />
        ))}
        {trialsWentToClass.length > 10 && (
          <button
            onClick={() => router.push("/dashboard/trials")}
            className="text-pink-400 text-sm hover:underline mt-2"
          >
            Ver todos ({trialsWentToClass.length})
          </button>
        )}
      </SalesSection>

      {/* Priority 2: Trials que faltaram */}
      <SalesSection
        title="Prioridade 2: Trials que faltaram"
        borderColor="border-amber-600"
        count={trialsMissed.length}
        emptyText="Nenhum trial que faltou pendente."
      >
        {trialsMissed.slice(0, 10).map((t, i) => (
          <LeadRow
            key={String(t.id || t.customer_id || i)}
            name={`${t.first_name || ""} ${t.last_name || ""}`.trim() || "Sem nome"}
            email={String(t.email || "")}
            pill={<Pill color="amber"><XIcon /> Faltou</Pill>}
          />
        ))}
        {trialsMissed.length > 10 && (
          <button
            onClick={() => router.push("/dashboard/trials")}
            className="text-amber-400 text-sm hover:underline mt-2"
          >
            Ver todos ({trialsMissed.length})
          </button>
        )}
      </SalesSection>

      {/* Priority 3: Leads frios */}
      <SalesSection
        title="Prioridade 3: Leads frios"
        borderColor="border-purple-600"
        count={leadsActionable.length}
        emptyText="Nenhum lead frio pendente."
      >
        {leadsActionable.slice(0, 10).map((l, i) => (
          <LeadRow
            key={String(l.id || l.customer_id || i)}
            name={`${l.first_name || ""} ${l.last_name || ""}`.trim() || "Sem nome"}
            email={String(l.email || "")}
            pill={<Pill color="purple">Lead</Pill>}
          />
        ))}
        {leadsActionable.length > 10 && (
          <button
            onClick={() => router.push("/dashboard/leads")}
            className="text-purple-400 text-sm hover:underline mt-2"
          >
            Ver todos ({leadsActionable.length})
          </button>
        )}
      </SalesSection>
    </div>
  );
}

/* ─── Sub-components ─── */

function ActionRow({
  color,
  label,
  onClick,
}: {
  color: "red" | "amber" | "pink" | "purple" | "blue";
  label: string;
  onClick: () => void;
}) {
  const dotColor = {
    red: "bg-red-500",
    amber: "bg-amber-500",
    pink: "bg-pink-500",
    purple: "bg-purple-500",
    blue: "bg-blue-500",
  }[color];

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full text-left p-3 rounded-lg bg-black/30 hover:bg-black/50 transition"
    >
      <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
      <span className="text-sm text-zinc-300">{label}</span>
    </button>
  );
}

function SalesSection({
  title,
  borderColor,
  count,
  emptyText,
  children,
}: {
  title: string;
  borderColor: string;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`border ${borderColor} rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-zinc-500 text-sm">{count} registos</span>
      </div>
      {count === 0 ? (
        <div className="text-zinc-500 text-sm py-2">{emptyText}</div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function LeadRow({
  name,
  email,
  pill,
}: {
  name: string;
  email: string;
  pill: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-black/30">
      <div>
        <div className="text-sm font-medium text-white">{name}</div>
        <div className="text-xs text-zinc-500">{email}</div>
      </div>
      {pill}
    </div>
  );
}
