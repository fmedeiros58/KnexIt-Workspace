"use client";

import type { ReferenceAuditIssue } from "../organizationTypes";

const ISSUE_CLASS: Record<ReferenceAuditIssue["severity"], string> = {
  info: "border-blue-200 bg-blue-50 text-blue-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
};

export function ReferenceAuditPanel({ issues }: { issues: ReferenceAuditIssue[] }) {
  if (!issues.length) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
        Nenhuma pendência de referência encontrada.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pendências</p>
      {issues.map((issue) => (
        <div key={issue.id} className={`rounded-lg border p-2 text-xs ${ISSUE_CLASS[issue.severity]}`}>
          <p className="font-semibold">{issue.severity === "error" ? "Erro" : issue.severity === "warning" ? "Atenção" : "Info"}</p>
          <p className="mt-1 leading-relaxed">{issue.message}</p>
        </div>
      ))}
    </div>
  );
}
