"use client";

import type { MailTemplate } from "@/lib/knexmail/types";

type Props = {
  templates: MailTemplate[];
  onSelect: (tmpl: MailTemplate) => void;
};

export default function TemplateList({ templates, onSelect }: Props) {
  if (!templates.length) return <div className="text-sm text-slate-500">Nenhum template cadastrado.</div>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Nome</th>
            <th className="px-4 py-2">Descrição</th>
            <th className="px-4 py-2">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2 font-semibold text-slate-900 cursor-pointer" onClick={() => onSelect(t)}>
                {t.name}
              </td>
              <td className="px-4 py-2 text-slate-700">{t.description || "-"}</td>
              <td className="px-4 py-2 text-slate-600">{t.updatedAt ? new Date(t.updatedAt).toLocaleString() : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

