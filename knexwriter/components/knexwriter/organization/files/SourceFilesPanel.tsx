"use client";

import { FilePlus2, FolderOpen } from "lucide-react";
import type { InsertCitationFromSourceInput, ReferenceUsage, SourceFile, SourceFileType } from "../organizationTypes";
import { getUnusedSourceFiles } from "../references/referenceUtils";
import { SourceFileCard } from "./SourceFileCard";

export type ImportedDocumentSummary = {
  fileName: string;
  fileType: string;
  fileSize: number;
  importedAt: string;
};

export function SourceFilesPanel({
  projectId,
  sourceFiles,
  usages,
  query,
  importedDocument,
  onOpenFilePicker,
  onRegisterImportedDocument,
  onInsertCitationFromSource,
}: {
  projectId: string | null;
  sourceFiles: SourceFile[];
  usages: ReferenceUsage[];
  query: string;
  importedDocument: ImportedDocumentSummary | null;
  onOpenFilePicker: () => void;
  onRegisterImportedDocument: (input: { name: string; type: SourceFileType }) => void;
  onInsertCitationFromSource: (input: InsertCitationFromSourceInput) => void;
}) {
  const projectSourceFiles = projectId ? sourceFiles.filter((sourceFile) => sourceFile.projectId === projectId) : [];
  const projectUsages = projectId ? usages.filter((usage) => usage.projectId === projectId) : [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredFiles = normalizedQuery
    ? projectSourceFiles.filter((sourceFile) => sourceFile.name.toLowerCase().includes(normalizedQuery))
    : projectSourceFiles;
  const unusedFiles = getUnusedSourceFiles(projectSourceFiles, projectUsages);

  if (!projectId) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
        <p className="font-medium text-zinc-800">Selecione um projeto.</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">Arquivos disponíveis são vinculados ao projeto ativo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-300 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Arquivos do projeto</p>
            <p className="mt-1 text-xs text-zinc-500">{unusedFiles.length} fonte{unusedFiles.length === 1 ? "" : "s"} ainda sem uso real no texto.</p>
          </div>
          <button
            type="button"
            onClick={onOpenFilePicker}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            <FolderOpen size={13} /> Vincular arquivo
          </button>
        </div>

        {importedDocument ? (
          <button
            type="button"
            onClick={() => onRegisterImportedDocument({ name: importedDocument.fileName, type: inferSourceFileType(importedDocument.fileType) })}
            className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            <FilePlus2 size={13} /> Registrar arquivo importado como fonte
          </button>
        ) : null}
      </div>

      {filteredFiles.length ? (
        <div className="space-y-2">
          {filteredFiles.map((sourceFile) => (
            <SourceFileCard
              key={sourceFile.id}
              sourceFile={sourceFile}
              usages={projectUsages}
              onUseAsDirectQuote={(sourceFileId) =>
                onInsertCitationFromSource({
                  sourceFileId,
                  usageType: "direct_quote",
                  quoteText: "Trecho citado a partir da fonte selecionada.",
                  citationText: "Citação direta vinculada à fonte.",
                })
              }
              onUseAsIndirectQuote={(sourceFileId) =>
                onInsertCitationFromSource({
                  sourceFileId,
                  usageType: "indirect_quote",
                  citationText: "Citação indireta vinculada à fonte.",
                })
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
          <p className="font-medium text-zinc-800">Nenhum arquivo registrado.</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Arquivos anexados ficam aqui como fontes disponíveis e não entram automaticamente na bibliografia.
          </p>
        </div>
      )}
    </div>
  );
}

function inferSourceFileType(fileType: string): SourceFileType {
  const normalized = fileType.toLowerCase();
  if (normalized.includes("pdf")) return "pdf";
  if (normalized.includes("doc")) return "docx";
  if (normalized.includes("image") || normalized.includes("png") || normalized.includes("jpg")) return "image";
  if (normalized.includes("sheet") || normalized.includes("csv") || normalized.includes("xls")) return "spreadsheet";
  return "other";
}
