"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { LoaderIcon } from "@/components/icons";
import { getPlan, isPTPlan, isNonActionableLead } from "@/lib/utils";
import { ALL_SUB_IDS } from "@/lib/constants";

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
  membership_type_name?: string;
  paid_until?: string;
  status?: string;
  status_text?: string;
  ended_because?: string | null;
  next_payment?: { date?: string | null; amount?: number } | null;
}

type Category =
  | "inadimplente"
  | "cartao_falta"
  | "pausado"
  | "termina"
  | "churn_cliente"
  | "churn_yogo"
  | "churn_admin"
  | "pt_migrar";

interface ClassifiedRow {
  customer: Customer;
  membership: Membership;
  category: Category;
  plan: string;
  isPT: boolean;
}

const STATUS_PRIORITY: Record<string, number> = { active: 0, cancelled_running: 1, ended: 2 };

function pickBestMembership(mbs: Membership[]): Membership | null {
  if (mbs.length === 0) return null;
  return [...mbs].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status ?? ""] ?? 99;
    const pb = STATUS_PRIORITY[b.status ?? ""] ?? 99;
    if (pa !== pb) return pa - pb;
    return (b.paid_until ?? "").localeCompare(a.paid_until ?? "");
  })[0];
}

function classify(m: Membership, plan: string): Category | null {
  const txt = (m.status_text ?? "").trim();
  if (m.status === "active") {
    if (/^Paus/i.test(txt)) return "pausado";
    if (/Cartão/.test(txt)) return "cartao_falta";
    if (/falhou/i.test(txt)) return "inadimplente";
    return null;
  }
  if (m.status === "cancelled_running") return "termina";
  if (m.status === "ended") {
    if (isPTPlan(plan)) return "pt_migrar";
    if (m.ended_because === "payment_failed") return "churn_yogo";
    if (m.ended_because === "admin_action") return "churn_admin";
    if (m.ended_because === "cancelled") return "churn_cliente";
    return null;
  }
  return null;
}

const PT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmtShort(d?: string): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return d;
  return `${day} ${PT_MONTHS[m - 1]}`;
}

function daysFrom(d?: string): number | null {
  if (!d) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((new Date(d).getTime() - t.getTime()) / 86400000);
}

interface CategoryDef {
  id: Category;
  title: string;
  accent: string;
  bg: string;
  description: string;
  action: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "inadimplente",
    title: "Inadimplente · ainda treina",
    accent: "#FF2E88",
    bg: "rgba(255,46,136,0.08)",
    description: "Pagamento falhou nas últimas cobranças. O aluno continua a frequentar aulas mas deve dinheiro.",
    action: "Contactar HOJE para regularizar — Yogo termina automaticamente após N falhas.",
  },
  {
    id: "cartao_falta",
    title: "Cartão de pagamento em falta",
    accent: "#FFB627",
    bg: "rgba(255,182,39,0.08)",
    description: "Cartão expirado ou removido. Próxima renovação automática vai falhar.",
    action: "Pedir actualização do cartão antes do dia de cobrança.",
  },
  {
    id: "pausado",
    title: "Pausados",
    accent: "#C7CCD6",
    bg: "rgba(199,204,214,0.06)",
    description: "Aluno suspendeu temporariamente a subscrição. Pode estar Pausado, Pausa agendada, ou pausado por dunning.",
    action: "Confirmar previsão de retoma. Se pausa indefinida, considerar follow-up.",
  },
  {
    id: "termina",
    title: "Cancelaram · ainda activos",
    accent: "#FFB627",
    bg: "rgba(255,182,39,0.08)",
    description: "Pediram cancelamento mas mantêm acesso até ao fim do mês já pago (regra Yogo).",
    action: "Última oportunidade para reverter. Falar antes do fim do período.",
  },
  {
    id: "churn_cliente",
    title: "Churn · cancelaram",
    accent: "#FF6B6B",
    bg: "rgba(255,107,107,0.08)",
    description: "Saíram por vontade própria. Subscrição já terminou.",
    action: "Reactivar requer abordagem comercial. Entender o motivo da saída.",
  },
  {
    id: "churn_yogo",
    title: "Churn · Yogo terminou (pagamento)",
    accent: "#FF6B6B",
    bg: "rgba(255,107,107,0.08)",
    description: "Yogo terminou automaticamente por falha recorrente de cobrança. Recuperável se o cliente quiser actualizar pagamento.",
    action: "Contactar com link directo para nova subscrição.",
  },
  {
    id: "churn_admin",
    title: "Churn · admin terminou",
    accent: "#888",
    bg: "rgba(136,136,136,0.08)",
    description: "Subscrição terminada manualmente pela equipa.",
    action: "Decisão interna. Normalmente final.",
  },
  {
    id: "pt_migrar",
    title: "PT a migrar para passes",
    accent: "#00E5A0",
    bg: "rgba(0,229,160,0.08)",
    description: "Tinham PT recorrente (Marcelo 3x ou similar). Plano descontinuado — migrar para PT 4/8/12 Passes.",
    action: "Vender novo pack de passes. Lead quente, já conheciam o serviço.",
  },
];

function CustomerRow({ row }: { row: ClassifiedRow }) {
  const name = [row.customer.first_name, row.customer.last_name].filter(Boolean).join(" ") || "Sem nome";
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const phone = row.customer.phone?.trim();
  const dateLabel = row.membership.paid_until;
  const days = daysFrom(dateLabel);
  return (
    <div
      style={{
        background: "#0F0F14",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: "11px 12px",
        display: "flex",
        alignItems: "center",
        gap: 11,
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, #1f1f28 0%, #15151c 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "grid", placeItems: "center", flexShrink: 0,
          fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.02em",
        }}
      >
        {initials || "?"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 2, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span>{row.plan}</span>
          {phone && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <a href={`tel:${phone}`} style={{ color: "#A6E22E", fontWeight: 600 }}>{phone}</a>
            </>
          )}
        </div>
      </div>
      {dateLabel && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {row.category === "termina" ? "termina" : "até"}
          </div>
          <div style={{ fontSize: 13, color: "#fff", fontWeight: 700, marginTop: 1 }}>{fmtShort(dateLabel)}</div>
          {days != null && (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
              {days >= 0 ? `${days}d` : `há ${Math.abs(days)}d`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategorySection({ def, rows }: { def: CategoryDef; rows: ClassifiedRow[] }) {
  if (rows.length === 0) return null;
  const ptRows = rows.filter((r) => r.isPT);
  const groupRows = rows.filter((r) => !r.isPT);
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          background: def.bg,
          border: `1px solid ${def.accent}33`,
          borderLeft: `3px solid ${def.accent}`,
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <h3 className="head" style={{ margin: 0, fontSize: 15, color: "#fff", fontWeight: 700 }}>
            {def.title}
          </h3>
          <span style={{ fontSize: 22, fontWeight: 800, color: def.accent, fontFamily: "var(--font-num)" }}>{rows.length}</span>
        </div>
        <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.72)", margin: "6px 0 0", lineHeight: 1.45 }}>
          {def.description}
        </p>
        <p style={{ fontSize: 11.5, color: def.accent, margin: "4px 0 0", fontWeight: 600, lineHeight: 1.45 }}>
          → {def.action}
        </p>
      </div>

      {groupRows.length > 0 && (
        <div style={{ marginBottom: ptRows.length > 0 ? 10 : 0 }}>
          <div style={{ padding: "0 2px 4px", display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="head" style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
              Aulas em grupo
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{groupRows.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {groupRows.map((r) => <CustomerRow key={r.customer.id} row={r} />)}
          </div>
        </div>
      )}

      {ptRows.length > 0 && (
        <div>
          <div style={{ padding: "0 2px 4px", display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="head" style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
              Personal Trainer
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{ptRows.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ptRows.map((r) => <CustomerRow key={r.customer.id} row={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SaudeClientesPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ClassifiedRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [customersRaw, membershipsRaw] = await Promise.all([
        fetchReport("reports/customers", {
          filters: [{
            type: "hasMembershipOrClassPass",
            membershipTypeId: ALL_SUB_IDS,
            classPassTypeId: [],
            onlyActiveMembershipsOrClassPasses: false,
          }],
          returnColumnHeaders: true,
        }),
        fetchReport("reports/memberships-list", {}),
      ]);

      const customers = customersRaw as unknown as Customer[];
      const memberships = membershipsRaw as unknown as Membership[];

      const mbByUser: Record<number, Membership[]> = {};
      for (const m of memberships) {
        if (!m.user_id) continue;
        if (!mbByUser[m.user_id]) mbByUser[m.user_id] = [];
        mbByUser[m.user_id].push(m);
      }

      const classified: ClassifiedRow[] = [];
      for (const c of customers) {
        if (isNonActionableLead(c)) continue;
        const userMbs = mbByUser[c.id] ?? [];
        const best = pickBestMembership(userMbs);
        if (!best) continue;
        const plan = getPlan(best.membership_type_name);
        const cat = classify(best, plan);
        if (!cat) continue;
        classified.push({
          customer: c,
          membership: best,
          category: cat,
          plan,
          isPT: isPTPlan(plan),
        });
      }

      setRows(classified);
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

  const byCategory: Record<Category, ClassifiedRow[]> = {
    inadimplente: [], cartao_falta: [], pausado: [], termina: [],
    churn_cliente: [], churn_yogo: [], churn_admin: [], pt_migrar: [],
  };
  for (const r of rows) byCategory[r.category].push(r);

  const totalAttention = rows.length;
  const activeCount = byCategory.inadimplente.length + byCategory.cartao_falta.length + byCategory.pausado.length + byCategory.termina.length;
  const churnCount = byCategory.churn_cliente.length + byCategory.churn_yogo.length + byCategory.churn_admin.length;
  const ptMigrarCount = byCategory.pt_migrar.length;

  return (
    <div style={{ paddingBottom: 32 }}>
      <div style={{ padding: "4px 18px 14px" }}>
        <h1 className="head" style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>
          Saúde dos Clientes
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          Quem precisa de atenção. Activos sem problemas estão em Subscritores.
        </p>
      </div>

      <div style={{ padding: "0 18px 14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div style={{ background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 12 }}>
          <div className="head" style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>ACTIVOS C/ FLAG</div>
          <div className="num" style={{ fontSize: 26, color: "#FFB627" }}>{activeCount}</div>
        </div>
        <div style={{ background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 12 }}>
          <div className="head" style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>CHURN</div>
          <div className="num" style={{ fontSize: 26, color: "#FF6B6B" }}>{churnCount}</div>
        </div>
        <div style={{ background: "#0F0F14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 12 }}>
          <div className="head" style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>PT MIGRAR</div>
          <div className="num" style={{ fontSize: 26, color: "#00E5A0" }}>{ptMigrarCount}</div>
        </div>
      </div>

      <div style={{ padding: "0 18px" }}>
        {CATEGORIES.map((def) => (
          <CategorySection key={def.id} def={def} rows={byCategory[def.id]} />
        ))}
        {totalAttention === 0 && (
          <div style={{ padding: "20px 0", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
            Tudo OK — ninguém precisa de atenção agora.
          </div>
        )}
      </div>
    </div>
  );
}
