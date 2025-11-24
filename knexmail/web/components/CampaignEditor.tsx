"use client";

import { useState } from "react";
import type { MailCampaign, MailTemplate } from "@/lib/knexmail/types";
import RecipientSelector from "./RecipientSelector";

type Props = {
  campaign: MailCampaign | null;
  templates: MailTemplate[];
  onSave: (c: MailCampaign) => void;
};

const newCampaign = (): MailCampaign => ({
  id: `cmp-${Date.now()}`,
  name: "",
  templateId: "",
  targetType: "list",
  targetConfig: {},
  status: "draft",
});

export default function CampaignEditor({ campaign, templates, onSave }: Props) {
  const [draft, setDraft] = useState<MailCampaign>(campaign || newCampaign());
  const update = (patch: Partial<MailCampaign>) => setDraft({ ...draft, ...patch });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-xs font-semibold text-slate-600">Nome</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-semibold text-slate-600">Template</span>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={draft.templateId}
            onChange={(e) => update({ templateId: e.target.value })}
          >
            <option value="">Selecione</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-600">Público-alvo</span>
        <RecipientSelector onChange={(cfg) => update({ targetConfig: cfg })} />
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-slate-700">
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="status"
            value="draft"
            checked={draft.status === "draft"}
            onChange={() => update({ status: "draft" })}
          />
          Rascunho
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="status"
            value="ready"
            checked={draft.status === "ready"}
            onChange={() => update({ status: "ready" })}
          />
          Pronto
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="status"
            value="scheduled"
            checked={draft.status === "scheduled"}
            onChange={() => update({ status: "scheduled" })}
          />
          Agendado (futuro)
        </label>
      </div>

      <div className="flex justify-end">
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          onClick={() => onSave(draft)}
        >
          Salvar campanha
        </button>
      </div>
    </div>
  );
}

