"use client";

import type { ProjectReference } from "../organizationTypes";
import { formatReference } from "./referenceUtils";

export function ReferenceBibliographyPreview({ references }: { references: ProjectReference[] }) {
  if (!references.length) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
        <p className="font-medium text-zinc-800">Bibliografia final vazia.</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Apenas referências com uso real no texto entram nesta lista.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-300 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Bibliografia final</p>
      {references.map((reference) => (
        <p key={reference.id} className="text-xs leading-relaxed text-zinc-700">
          {reference.abntFormatted || formatReference(reference, "abnt")}
        </p>
      ))}
    </div>
  );
}
