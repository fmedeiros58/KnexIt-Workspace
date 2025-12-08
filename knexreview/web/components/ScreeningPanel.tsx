"use client";

import type { SearchResultRecord, ScreeningRecord, ScreeningDecision } from "@/lib/knexreview/types";

type Props = {
  results: SearchResultRecord[];
  decisions: ScreeningRecord[];
  onDecision: (rec: ScreeningRecord) => void;
};

export default function ScreeningPanel({ results, decisions, onDecision }: Props) {
  const decisionMap = new Map(decisions.map((d) => [d.recordId, d.decision]));
  const decide = (id: string, decision: ScreeningDecision) => onDecision({ recordId: id, decision });

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-900">Screening (título/resumo)</h3>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Título</th>
              <th className="px-4 py-2">Fonte</th>
              <th className="px-4 py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <div className="font-semibold text-slate-900">{r.title}</div>
                  <div className="text-xs text-slate-500 line-clamp-2">{r.abstract}</div>
                </td>
                <td className="px-4 py-2 text-slate-700">{r.source}</td>
                <td className="px-4 py-2">
                  <div className="inline-flex gap-2">
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${decisionMap.get(r.id) === "include" ? "bg-emerald-100 text-emerald-800" : "border border-emerald-200 text-emerald-700"}`}
                      onClick={() => decide(r.id, "include")}
                    >
                      Incluir
                    </button>
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${decisionMap.get(r.id) === "maybe" ? "bg-amber-100 text-amber-800" : "border border-amber-200 text-amber-700"}`}
                      onClick={() => decide(r.id, "maybe")}
                    >
                      Em dúvida
                    </button>
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${decisionMap.get(r.id) === "exclude" ? "bg-rose-100 text-rose-800" : "border border-rose-200 text-rose-700"}`}
                      onClick={() => decide(r.id, "exclude")}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

