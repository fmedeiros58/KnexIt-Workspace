"use client";

import type { ReferenceUsage } from "../organizationTypes";

const USAGE_LABEL: Record<ReferenceUsage["usageType"], string> = {
  direct_quote: "Citação direta",
  indirect_quote: "Citação indireta",
  paraphrase: "Paráfrase",
  note: "Nota vinculada",
  ai_inserted_citation: "Citação inserida por IA",
};

export function ReferenceUsageList({
  usages,
  onRemoveUsage,
}: {
  usages: ReferenceUsage[];
  onRemoveUsage?: (usageId: string) => void;
}) {
  if (!usages.length) {
    return <p className="text-xs text-zinc-500">Nenhum uso registrado no texto.</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      {usages.map((usage) => (
        <div key={usage.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-zinc-700">{USAGE_LABEL[usage.usageType]}</span>
            {onRemoveUsage ? (
              <button
                type="button"
                onClick={() => onRemoveUsage(usage.id)}
                className="text-[11px] font-medium text-rose-600 hover:text-rose-700"
              >
                Remover uso
              </button>
            ) : null}
          </div>
          {usage.sourcePage ? <p className="mt-1 text-zinc-500">Página/local: {usage.sourcePage}</p> : null}
          {usage.quoteText ? <p className="mt-1 line-clamp-3 text-zinc-600">{usage.quoteText}</p> : null}
          {usage.citationText ? <p className="mt-1 font-medium text-zinc-600">{usage.citationText}</p> : null}
        </div>
      ))}
    </div>
  );
}
