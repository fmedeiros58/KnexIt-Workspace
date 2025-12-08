"use client";

import type { MailCampaign, MailTemplate } from "@/lib/knexmail/types";

type Props = {
  campaigns: MailCampaign[];
  templates: MailTemplate[];
  onSelect: (c: MailCampaign) => void;
};

export default function CampaignList({ campaigns, templates, onSelect }: Props) {
  const templateName = (id: string) => templates.find((t) => t.id === id)?.name || "N/D";

  if (!campaigns.length) return <div className="text-sm text-slate-500">Nenhuma campanha.</div>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Nome</th>
            <th className="px-4 py-2">Template</th>
            <th className="px-4 py-2">Público</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2 font-semibold text-slate-900 cursor-pointer" onClick={() => onSelect(c)}>
                {c.name}
              </td>
              <td className="px-4 py-2 text-slate-700">{templateName(c.templateId)}</td>
              <td className="px-4 py-2 text-slate-700">{c.targetType}</td>
              <td className="px-4 py-2 text-slate-700">{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

