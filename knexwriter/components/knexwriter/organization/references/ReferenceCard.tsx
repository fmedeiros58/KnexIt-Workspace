"use client";

import { useState } from "react";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import type { ProjectReference, ReferenceUsage, SourceFile } from "../organizationTypes";
import { formatReference, getReferenceUsageCount, getReferenceUsagesByReference } from "./referenceUtils";
import { ReferenceUsageList } from "./ReferenceUsageList";

const STATUS_LABEL: Record<ProjectReference["metadataStatus"], string> = {
  partial: "metadados parciais",
  complete: "metadados completos",
  needs_review: "revisar metadados",
};

export function ReferenceCard({
  reference,
  usages,
  sourceFile,
  onRemoveReference,
  onRemoveUsage,
}: {
  reference: ProjectReference;
  usages: ReferenceUsage[];
  sourceFile?: SourceFile;
  onRemoveReference: (referenceId: string) => void;
  onRemoveUsage: (usageId: string) => void;
}) {
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const usageCount = getReferenceUsageCount(reference.id, usages);
  const referenceUsages = getReferenceUsagesByReference(reference.id, usages);
  const formattedReference = reference.abntFormatted || formatReference(reference, "abnt");

  const copyFormattedReference = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(formattedReference);
  };

  return (
    <article className="rounded-lg border border-zinc-300 bg-white p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold uppercase tracking-wide text-zinc-900">{reference.author || "Autor não informado"}</p>
          <h3 className="mt-1 font-medium text-zinc-900">{reference.title}</h3>
        </div>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600">
          {STATUS_LABEL[reference.metadataStatus]}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-500">
        <div>
          <dt className="font-semibold text-zinc-600">Ano</dt>
          <dd>{reference.year || "s.d."}</dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-600">Tipo</dt>
          <dd>{reference.type}</dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-600">Usos no texto</dt>
          <dd>{usageCount}</dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-600">Arquivo</dt>
          <dd className="truncate" title={sourceFile?.name}>{sourceFile?.name || "Sem arquivo"}</dd>
        </div>
      </dl>

      <p className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs leading-relaxed text-zinc-600">
        {formattedReference}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setIsUsageOpen((current) => !current)} className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
          Ver usos
        </button>
        <button type="button" className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
          Editar metadados
        </button>
        <button type="button" onClick={copyFormattedReference} className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
          <Copy size={12} /> Copiar
        </button>
        {sourceFile?.externalUrl || sourceFile?.fileUrl ? (
          <a
            href={sourceFile.externalUrl || sourceFile.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            <ExternalLink size={12} /> Abrir
          </a>
        ) : null}
        {!usageCount ? (
          <button type="button" onClick={() => onRemoveReference(reference.id)} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">
            <Trash2 size={12} /> Remover
          </button>
        ) : null}
      </div>

      {isUsageOpen ? <ReferenceUsageList usages={referenceUsages} onRemoveUsage={onRemoveUsage} /> : null}
    </article>
  );
}
