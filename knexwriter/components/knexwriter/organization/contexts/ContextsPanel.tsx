"use client";

import type { OrganizationContextItem } from "../organizationTypes";

export function ContextsPanel({ contexts, query }: { contexts: OrganizationContextItem[]; query: string }) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredContexts = normalizedQuery
    ? contexts.filter((context) => `${context.label} ${context.summary ?? ""}`.toLowerCase().includes(normalizedQuery))
    : contexts;

  if (!filteredContexts.length) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
          <p className="font-medium text-zinc-800">Contextos recorrentes</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">Os contextos detectados no texto aparecerão aqui.</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-500">
          Preparado para repetição literal, redundância, incoerência, contradições e retomadas úteis.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredContexts.map((context) => (
        <article key={context.id} className="rounded-lg border border-zinc-300 bg-white p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-zinc-900">{context.label}</h3>
              {context.summary ? <p className="mt-1 text-xs leading-relaxed text-zinc-500">{context.summary}</p> : null}
            </div>
            {context.severity ? (
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-500">
                {context.severity}
              </span>
            ) : null}
          </div>
          {typeof context.occurrenceCount === "number" ? (
            <p className="mt-2 text-[11px] font-medium text-zinc-500">Ocorrências: {context.occurrenceCount}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
