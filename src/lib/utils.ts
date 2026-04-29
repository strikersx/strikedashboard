export function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function eur(n: number): string {
  return "€" + (n || 0).toLocaleString("pt-PT", { maximumFractionDigits: 0 });
}

export function monthLabel(m: number): string {
  return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m];
}

export function getToday(): string { return fmtDate(new Date()); }

export function getWeekEnd(): string {
  const t = new Date(); t.setDate(t.getDate() + 6); return fmtDate(t);
}

export function getMonthEnd(): string {
  const t = new Date(); return fmtDate(new Date(t.getFullYear(), t.getMonth() + 1, 0));
}

export function getDashboardRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const minEnd = new Date(today); minEnd.setDate(today.getDate() + 7);
  const end = endOfMonth > minEnd ? endOfMonth : minEnd;
  return { startDate: fmtDate(today), endDate: fmtDate(end) };
}

export function getLast30Days(): { startDate: string; endDate: string } {
  const t = new Date(); const p = new Date(t); p.setDate(t.getDate() - 30);
  return { startDate: fmtDate(p), endDate: fmtDate(t) };
}

export function isToday(dateStr: string): boolean { return dateStr === getToday(); }
export function isThisWeek(dateStr: string): boolean { return dateStr >= getToday() && dateStr <= getWeekEnd(); }
export function isThisMonth(dateStr: string): boolean { return dateStr >= getToday() && dateStr <= getMonthEnd(); }

export function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getPlan(desc: string | null | undefined): string {
  if (!desc) return "Outros";
  if (/PT 12 Passes/i.test(desc)) return "PT 12 Passes";
  if (/PT 8 Passes/i.test(desc)) return "PT 8 Passes";
  if (/PT 4 Passes/i.test(desc)) return "PT 4 Passes";
  if (/PT \(Marcelo\)/i.test(desc)) return "PT (Marcelo) | 3x/sem";
  if (/24 sessões\/mês/i.test(desc)) return "24 sessões/mês";
  if (/12 sessões\/mês/i.test(desc)) return "12 sessões/mês";
  if (/8 sessões\/mês/i.test(desc)) return "8 sessões/mês";
  if (/Striking Trimestral/i.test(desc)) return "Striking Trimestral";
  return "Outros";
}

export function isPTPlan(plan: string): boolean { return /^PT/.test(plan); }

export function planColor(plan: string): string {
  if (/24 sessões/i.test(plan)) return "electric";
  if (/12 sessões/i.test(plan)) return "blue";
  if (/8 sessões/i.test(plan)) return "mint";
  if (/Trimestral/i.test(plan)) return "lime";
  if (/PT.*3x/i.test(plan)) return "magenta";
  if (/PT 12/i.test(plan)) return "magenta";
  if (/PT 8/i.test(plan)) return "coral";
  if (/PT 4/i.test(plan)) return "amber";
  return "blue";
}

export function isNonActionableLead(customer: { email?: string }): boolean {
  const email = (customer.email || "").toLowerCase();
  if (email.startsWith("usc-") && email.includes("urbansportsclub.com")) return true;
  if (email.includes("@strikershouse.") || email.includes("@striker.pt") || email.includes("@strikerhouse.com")) return true;
  return false;
}

export function parseReport(response: unknown): Record<string, unknown>[] {
  if (!response) return [];
  if (Array.isArray(response)) {
    if (response.length === 0) return [];
    if (typeof response[0] === "object" && !Array.isArray(response[0])) return response;
    if (Array.isArray(response[0])) {
      const [headers, ...rows] = response as unknown[][];
      return rows.map((row) => Object.fromEntries((headers as string[]).map((h, i) => [h, row[i]])));
    }
  }
  const obj = response as Record<string, unknown>;
  if (obj.data !== undefined) return parseReport(obj.data);
  if (Array.isArray(obj.rows)) {
    const headers = (obj.columns || obj.headers || obj.columnHeaders) as string[] | undefined;
    if (headers && obj.rows.length > 0 && Array.isArray(obj.rows[0])) {
      return (obj.rows as unknown[][]).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
    }
    return obj.rows as Record<string, unknown>[];
  }
  if (obj.result) return parseReport(obj.result);
  if (obj.results) return parseReport(obj.results);
  if (obj.customers) return parseReport(obj.customers);
  if (obj.users) return parseReport(obj.users);
  return [];
}
