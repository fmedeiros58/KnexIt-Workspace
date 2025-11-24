"use client";

import type { GenericSearchStrategy, BooleanTermGroup, BooleanOperator } from "@/lib/knexreview/types";

type Props = {
  strategy: GenericSearchStrategy;
  onChange: (s: GenericSearchStrategy) => void;
};

const genId = () => Math.random().toString(36).slice(2, 10);

export default function BooleanQueryBuilder({ strategy, onChange }: Props) {
  const addGroup = () => {
    const newGroup: BooleanTermGroup = {
      id: genId(),
      terms: [{ term: "exemplo", field: "title", truncation: false }],
      joinWith: "OR",
    };
    onChange({ ...strategy, groups: [...strategy.groups, newGroup] });
  };

  const updateGroupTerm = (groupId: string, index: number, value: string) => {
    const groups = strategy.groups.map((g) => {
      if (g.id !== groupId) return g;
      if (index === g.terms.length) {
        return { ...g, terms: [...g.terms, { term: value, field: "title", truncation: false }] };
      }
      return { ...g, terms: g.terms.map((t, i) => (i === index ? { ...t, term: value } : t)) };
    });
    onChange({ ...strategy, groups });
  };

  const changeJoin = (op: BooleanOperator) => onChange({ ...strategy, betweenGroupsOperator: op });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Estratégia booleana</h2>
          <p className="text-sm text-slate-600">Agrupe sinônimos com OR e combine grupos com AND/NOT.</p>
        </div>
        <button
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          onClick={addGroup}
        >
          Adicionar grupo
        </button>
      </div>

      <div className="space-y-3">
        {strategy.groups.map((g) => (
          <div key={g.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Grupo</span>
              <span className="font-semibold text-slate-800">{g.joinWith}</span>
              <span>entre termos</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {g.terms.map((t, idx) => (
                <input
                  key={idx}
                  value={t.term}
                  onChange={(e) => updateGroupTerm(g.id, idx, e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="termo"
                />
              ))}
              <button
                className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => updateGroupTerm(g.id, g.terms.length, "")}
              >
                + termo
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 text-sm text-slate-700">
        <span>Operador entre grupos:</span>
        {(["AND", "OR", "NOT"] as BooleanOperator[]).map((op) => (
          <button
            key={op}
            className={`rounded-full px-3 py-1 ${strategy.betweenGroupsOperator === op ? "bg-indigo-100 text-indigo-800" : "hover:bg-slate-100"}`}
            onClick={() => changeJoin(op)}
          >
            {op}
          </button>
        ))}
      </div>
    </div>
  );
}
