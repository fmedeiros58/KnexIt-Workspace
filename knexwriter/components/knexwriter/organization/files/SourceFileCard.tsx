"use client";

import { BookOpen, FileText, Quote } from "lucide-react";
import type { ReferenceUsage, SourceFile } from "../organizationTypes";

const FILE_STATUS_CLASS = {
  available: "border-sky-200 bg-sky-50 text-sky-700",
  used: "border-emerald-200 bg-emerald-50 text-emerald-700",
  unused: "border-zinc-200 bg-zinc-50 text-zinc-600",
  missing: "border-rose-200 bg-rose-50 text-rose-700",
  incomplete: "border-amber-200 bg-amber-50 text-amber-700",
  review: "border-rose-200 bg-rose-50 text-rose-700",
};

export function SourceFileCard({
  sourceFile,
  usages,
  onUseAsDirectQuote,
  onUseAsIndirectQuote,
}: {
  sourceFile: SourceFile;
  usages: ReferenceUsage[];
  onUseAsDirectQuote: (sourceFileId: string) => void;
  onUseAsIndirectQuote: (sourceFileId: string) => void;
}) {
  const isUsed = usages.some((usage) => usage.sourceFileId === sourceFile.id);
  const status = getSourceFileStatus(sourceFile, isUsed);

  return (
    <article className="rounded-lg border border-zinc-300 bg-white p-3 text-sm">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 rounded-md border border-zinc-200 bg-zinc-50 p-1.5 text-zinc-500">
          <FileText size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-zinc-900" title={sourceFile.name}>{sourceFile.name}</h3>
          <p className="mt-1 text-xs text-zinc-500">Tipo: {sourceFile.type}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${FILE_STATUS_CLASS[status.kind]}`}>
          {status.label}
        </span>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-500">
          {sourceFile.metadataStatus}
        </span>
        {sourceFile.rootFolderName ? (
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-500">
            Pasta: {sourceFile.rootFolderName}
          </span>
        ) : null}
      </div>

      {sourceFile.bibliographicMetadata?.title ? (
        <p className="mt-2 line-clamp-2 text-xs text-zinc-600">{sourceFile.bibliographicMetadata.title}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onUseAsDirectQuote(sourceFile.id)}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
        >
          <Quote size={12} /> Usar citação direta
        </button>
        <button
          type="button"
          onClick={() => onUseAsIndirectQuote(sourceFile.id)}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
        >
          <BookOpen size={12} /> Citação indireta
        </button>
      </div>
    </article>
  );
}

function getSourceFileStatus(sourceFile: SourceFile, isUsed: boolean): { kind: keyof typeof FILE_STATUS_CLASS; label: string } {
  if (sourceFile.status === "missing") return { kind: "missing", label: "Arquivo não acessível" };
  if (sourceFile.metadataStatus === "needs_review") return { kind: "review", label: "Pendente de revisão" };
  if (sourceFile.metadataStatus !== "complete") return { kind: "incomplete", label: "Metadados incompletos" };
  if (isUsed) return { kind: "used", label: "Usado" };
  return sourceFile.status === "available"
    ? { kind: "available", label: "Disponível" }
    : { kind: "unused", label: "Não usado" };
}
