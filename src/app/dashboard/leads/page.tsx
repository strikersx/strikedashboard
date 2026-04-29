"use client";

import { useEffect, useCallback, useState } from "react";
import { useYogoFetch } from "@/hooks/use-yogo";
import { useDashboard } from "@/app/dashboard/layout";
import { LoaderIcon } from "@/components/icons";
import { isNonActionableLead } from "@/lib/utils";
import { TRIAL_CLASS_PASS_ID } from "@/lib/constants";

interface Customer {
  id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  createdAt?: string;
}

interface Lead {
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

function LeadRow({ name, email, phone, createdAt }: Lead) {
  return (
    <div style={{
      background: "#0F0F14",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12,
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", lineHeight: 1.3 }}>{name}</span>
        {phone && phone !== "—" && (
          <span style={{ fontSize: 12, color: "#A6E22E", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>{phone}</span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
        {createdAt && createdAt !== "—" && (
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap", flexShrink: 0 }}>
            {String(createdAt).replace(/ às \d{2}:\d{2}.*/, "")}
          </span>
        )}
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const { refreshKey, setLastFetch } = useDashboard();
  const { fetchReport } = useYogoFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchReport("reports/customers", {
        filters: [
          { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
          { type: "hasNoClassPass", classPassTypeId: [TRIAL_CLASS_PASS_ID], onlyActiveClassPasses: false },
        ],
        returnColumnHeaders: true,
      });

      const parseYogoDate = (s: string): number => {
        const MONTHS: Record<string, number> = {
          janeiro: 1, fevereiro: 2, março: 3, abril: 4, maio: 5, junho: 6,
          julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
        };
        const m = s.match(/(\d+) de (\w+) de (\d{4})(?: às (\d{2}):(\d{2}))?/);
        if (!m) return 0;
        const [, d, mon, y, h = "0", min = "0"] = m;
        const month = MONTHS[mon.toLowerCase()];
        if (!month) return 0;
        return new Date(+y, month - 1, +d, +h, +min).getTime();
      };

      const actionable = (rows as unknown as Customer[])
        .filter((c) => !isNonActionableLead(c))
        .map((c) => ({
          name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sem nome",
          email: c.email || "—",
          phone: c.phone || "—",
          createdAt: c.createdAt || "—",
        }))
        .sort((a, b) => parseYogoDate(b.createdAt) - parseYogoDate(a.createdAt));

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
  if (error) return <div className="py-20 text-center text-tone-coral text-sm">Erro: {error}</div>;

  return (
    <div style={{ paddingBottom: 32 }}>
      <div style={{ padding: "4px 18px 14px" }}>
        <h1 className="head" style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>
          Leads
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          Interessados que se cadastraram
        </p>
      </div>

      <div style={{ padding: "0 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
        <h3 className="head" style={{ margin: 0, fontSize: 18, color: "#fff" }}>Leads</h3>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{leads.length}</span>
      </div>

      <div style={{ padding: "4px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        {leads.length === 0 ? (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0" }}>
            Nenhum lead encontrado.
          </div>
        ) : (
          leads.map((l, i) => (
            <LeadRow key={i} {...l} />
          ))
        )}
      </div>
    </div>
  );
}
