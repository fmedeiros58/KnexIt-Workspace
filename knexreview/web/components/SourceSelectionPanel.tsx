"use client";

import { getAllSources, getEnabledSources } from "@/lib/knexreview/sourceRegistry";
import type { SourceId } from "@/lib/knexreview/types";

type Props = {
  selected: SourceId[];
  onChange: (s: SourceId[]) => void;
};

export default function SourceSelectionPanel({ selected, onChange }: Props) {
  const all = getAllSources();
  const enabledIds = new Set(getEnabledSources((typeof process !== "undefined" ? (process as any).env : {}) as NodeJS.ProcessEnv).map((s) => s.id));

  const toggle = (id: SourceId) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Fontes</h3>
        <p className="text-sm text-slate-600">Selecione bases oficiais. Desabilitadas se faltarem credenciais.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {all.map((src) => {
          const enabled = enabledIds.has(src.id);
          const isSel = selected.includes(src.id);
          return (
            <button
              key={src.id}
              disabled={!enabled}
              onClick={() => toggle(src.id)}
              className={`text-left rounded-lg border px-3 py-2 text-sm ${
                isSel ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"
              } ${!enabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50"}`}
            >
              <div className="font-semibold text-slate-900">{src.displayName}</div>
              <div className="text-[12px] text-slate-500">
                {enabled ? "Disponível" : "Desabilitada (configure env)"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
