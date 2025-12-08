"use client";

import { useState } from "react";
import type { MailTemplate } from "@/lib/knexmail/types";

type Props = {
  template: MailTemplate | null;
  onSave: (tmpl: MailTemplate) => void;
};

const newTemplate = (): MailTemplate => ({
  id: `tmpl-${Date.now()}`,
  name: "",
  subject: "",
  body: "",
  bodyHtml: "",
  variables: [],
  description: "",
  updatedAt: new Date().toISOString(),
});

export default function TemplateEditor({ template, onSave }: Props) {
  const [draft, setDraft] = useState<MailTemplate>(
    template
      ? {
          ...template,
          body: template.body ?? template.bodyHtml ?? "",
          bodyHtml: template.bodyHtml ?? template.body ?? "",
        }
      : newTemplate(),
  );

  const update = (patch: Partial<MailTemplate>) =>
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      if (patch.body !== undefined) next.bodyHtml = patch.bodyHtml ?? patch.body;
      if (patch.bodyHtml !== undefined) next.body = patch.body ?? patch.bodyHtml;
      next.updatedAt = new Date().toISOString();
      return next;
    });

  const parseVariables = (text: string) => {
    const vars = Array.from(text.matchAll(/{{\s*([\w.]+)\s*}}/g)).map((m) => m[1]);
    return Array.from(new Set(vars));
  };

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
          <span className="text-xs font-semibold text-slate-600">Descricao</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={draft.description ?? ""}
            onChange={(e) => update({ description: e.target.value })}
          />
        </label>
      </div>

      <label className="space-y-1 text-sm">
        <span className="text-xs font-semibold text-slate-600">Assunto</span>
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={draft.subject}
          onChange={(e) => update({ subject: e.target.value })}
        />
      </label>

      <label className="space-y-1 text-sm">
        <span className="text-xs font-semibold text-slate-600">Corpo (HTML ou texto)</span>
        <textarea
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          rows={6}
          value={draft.bodyHtml ?? draft.body ?? ""}
          onChange={(e) =>
            update({ body: e.target.value, bodyHtml: e.target.value, variables: parseVariables(e.target.value) })
          }
          placeholder="<p>Ola {{nome}}</p>"
        />
      </label>

      <div className="flex items-center gap-2 text-xs text-slate-600">
        Variaveis detectadas: {draft.variables?.length ? draft.variables.join(", ") : "nenhuma"}
      </div>

      <div className="flex justify-end">
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          onClick={() => onSave(draft)}
        >
          Salvar template
        </button>
      </div>
    </div>
  );
}
