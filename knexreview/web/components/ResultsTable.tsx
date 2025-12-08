"use client";

import type { SearchResultRecord } from "@/lib/knexreview/types";

type Props = {
  results: SearchResultRecord[];
};

export default function ResultsTable({ results }: Props) {
  if (!results.length) {
    return <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Nenhum resultado ainda.</div>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2">Título</th>
            <th className="px-4 py-2">Autores</th>
            <th className="px-4 py-2">Ano</th>
            <th className="px-4 py-2">Fonte</th>
            <th className="px-4 py-2">DOI</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-4 py-2 font-medium text-slate-900">{r.title}</td>
              <td className="px-4 py-2 text-slate-700">{(r.authors || []).join(", ")}</td>
              <td className="px-4 py-2 text-slate-700">{r.year || "-"}</td>
              <td className="px-4 py-2 text-slate-700">{r.source}</td>
              <td className="px-4 py-2 text-blue-600">{r.doi || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

