"use client";

import type { MailLog } from "@/lib/knexmail/types";

type Props = {
  logs: MailLog[];
};

export default function MailLogsTable({ logs }: Props) {
  if (!logs.length) return <div className="text-sm text-slate-500">Nenhum log.</div>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Destinatário</th>
            <th className="px-4 py-2">Assunto</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Provider</th>
            <th className="px-4 py-2">Origem</th>
            <th className="px-4 py-2">Data</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-t border-slate-100">
              <td className="px-4 py-2 text-slate-800">{l.to}</td>
              <td className="px-4 py-2 text-slate-800">{l.subject}</td>
              <td className="px-4 py-2 text-slate-700">{l.status}</td>
              <td className="px-4 py-2 text-slate-700">{l.provider}</td>
              <td className="px-4 py-2 text-slate-700">{l.origin || "-"}</td>
              <td className="px-4 py-2 text-slate-600">{new Date(l.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

