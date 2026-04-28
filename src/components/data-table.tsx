"use client";
import { LoaderIcon } from "./icons";

interface DataTableProps { rows: Record<string, unknown>[] | undefined; loading?: boolean; error?: string | null; title?: string; empty?: string; maxCols?: number; }

export function DataTable({ rows, loading, error, title, empty = "Sem dados", maxCols = 8 }: DataTableProps) {
  if (loading) return <div className="py-12 text-center"><LoaderIcon /></div>;
  if (error) return <div className="py-12 text-center text-red-500 text-sm">Erro: {error}</div>;
  if (!rows || rows.length === 0) return <div className="py-12 text-center text-zinc-500">{empty}</div>;
  const cols = Object.keys(rows[0]).slice(0, maxCols);
  return (
    <div>
      {title && <h2 className="text-lg font-semibold mb-4">{title} <span className="text-zinc-500 font-normal">({rows.length})</span></h2>}
      <div className="overflow-x-auto -mx-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-zinc-800">{cols.map((c) => <th key={c} className="text-left p-2 px-3 text-zinc-500 font-medium text-xs uppercase tracking-wide">{c}</th>)}</tr></thead>
          <tbody>{rows.map((row, i) => <tr key={i} className="border-b border-zinc-800/40 hover:bg-black/40">{cols.map((c) => <td key={c} className="p-2 px-3 text-zinc-300">{String(row[c] ?? "—").slice(0, 80)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
