"use client";

import type { ReviewQuestion } from "@/lib/knexreview/types";

type Props = {
  question: ReviewQuestion;
  onChange: (q: ReviewQuestion) => void;
};

export default function QuestionBuilder({ question, onChange }: Props) {
  const update = (patch: Partial<ReviewQuestion>) => onChange({ ...question, ...patch });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Pergunta de pesquisa</h2>
        <p className="text-sm text-slate-600">Use PICO/PICOS/PICo ou defina um modelo customizado.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">Modelo</span>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={question.model}
            onChange={(e) => update({ model: e.target.value as ReviewQuestion["model"] })}
          >
            <option value="PICO">PICO</option>
            <option value="PICOS">PICOS</option>
            <option value="PICo">PICo</option>
            <option value="Custom">Custom</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">População</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={question.population || ""}
            onChange={(e) => update({ population: e.target.value })}
            placeholder="Ex: professores de educação física"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">Intervenção / Exposição</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={question.interventionOrExposure || ""}
            onChange={(e) => update({ interventionOrExposure: e.target.value })}
            placeholder="Ex: programa de treinamento"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">Comparador</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={question.comparator || ""}
            onChange={(e) => update({ comparator: e.target.value })}
            placeholder="Ex: cuidados usuais"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">Desfechos</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={question.outcomes || ""}
            onChange={(e) => update({ outcomes: e.target.value })}
            placeholder="Ex: desempenho, adesão, efeitos adversos"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">Contexto</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={question.context || ""}
            onChange={(e) => update({ context: e.target.value })}
            placeholder="Ex: escolas, clínicas, domicílio"
          />
        </label>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-semibold text-slate-600">Pergunta customizada (opcional)</span>
        <textarea
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          rows={3}
          value={question.customPrompt || ""}
          onChange={(e) => update({ customPrompt: e.target.value })}
          placeholder="Se preferir, descreva a pergunta em texto livre."
        />
      </div>
    </div>
  );
}

