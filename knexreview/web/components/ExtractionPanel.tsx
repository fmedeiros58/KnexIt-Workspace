"use client";

import type { SearchResultRecord, ExtractionRecord, ExtractionField } from "@/lib/knexreview/types";

type Props = {
  results: SearchResultRecord[];
  extractions: ExtractionRecord[];
  onExtraction: (rec: ExtractionRecord) => void;
};

const DEFAULT_FIELDS: ExtractionField[] = [
  { key: "design", label: "Desenho do estudo", value: "" },
  { key: "population", label: "População", value: "" },
  { key: "outcomes", label: "Desfechos", value: "" },
  { key: "results", label: "Resultados", value: "" },
];

export default function ExtractionPanel({ results, extractions, onExtraction }: Props) {
  if (!results.length) return <div className="text-sm text-slate-500">Nenhum estudo para extrair.</div>;

  const getExtraction = (id: string) => extractions.find((e) => e.recordId === id);
  const save = (id: string, fields: ExtractionField[]) => onExtraction({ recordId: id, fields });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">Extração de dados</h3>
      {results.map((r) => {
        const record = getExtraction(r.id) || { recordId: r.id, fields: DEFAULT_FIELDS };
        return (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{r.title}</div>
                <div className="text-xs text-slate-500">{r.source}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {record.fields.map((f, idx) => (
                <label key={f.key} className="space-y-1">
                  <span className="text-xs font-semibold text-slate-600">{f.label}</span>
                  <textarea
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    rows={2}
                    value={f.value}
                    onChange={(e) => {
                      const updated = record.fields.map((fi, i) => (i === idx ? { ...fi, value: e.target.value } : fi));
                      save(r.id, updated);
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

