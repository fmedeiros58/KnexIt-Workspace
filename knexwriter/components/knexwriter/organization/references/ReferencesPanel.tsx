"use client";

import type {
  InsertCitationFromSourceInput,
  ProjectReference,
  ReferenceFilter,
  ReferenceUsage,
  SourceFile,
  SourceFileType,
} from "../organizationTypes";
import {
  buildReferenceAuditIssues,
  getReferenceUsageCount,
  getUsedReferences,
} from "./referenceUtils";
import { ReferenceAuditPanel } from "./ReferenceAuditPanel";
import { ReferenceBibliographyPreview } from "./ReferenceBibliographyPreview";
import { ReferenceCard } from "./ReferenceCard";
import { ReferenceFilters } from "./ReferenceFilters";
import { SourceFileCard } from "../files/SourceFileCard";
import type { ImportedDocumentSummary } from "../files/SourceFilesPanel";

export function ReferencesPanel({
  projectId,
  sourceFiles,
  references,
  usages,
  query,
  activeFilter,
  onFilterChange,
  onRemoveReference,
  onRemoveUsage,
  importedDocument,
  onOpenFilePicker,
  onLinkProjectDirectory,
  onLinkSourceFiles,
  onAddManualReference,
  onRegisterSourceFile,
  onInsertCitationFromSource,
  isFileSystemAccessAvailable,
}: {
  projectId: string | null;
  sourceFiles: SourceFile[];
  references: ProjectReference[];
  usages: ReferenceUsage[];
  query: string;
  activeFilter: ReferenceFilter;
  onFilterChange: (filter: ReferenceFilter) => void;
  onRemoveReference: (referenceId: string) => void;
  onRemoveUsage: (usageId: string) => void;
  importedDocument: ImportedDocumentSummary | null;
  onOpenFilePicker: () => void;
  onLinkProjectDirectory: () => void;
  onLinkSourceFiles: () => void;
  onAddManualReference: () => void;
  onRegisterSourceFile: (input: { name: string; type: SourceFileType }) => void;
  onInsertCitationFromSource: (input: InsertCitationFromSourceInput) => void;
  isFileSystemAccessAvailable: boolean;
}) {
  const projectSourceFiles = projectId ? sourceFiles.filter((sourceFile) => sourceFile.projectId === projectId) : [];
  const projectReferences = projectId ? references.filter((reference) => reference.projectId === projectId) : [];
  const projectUsages = projectId ? usages.filter((usage) => usage.projectId === projectId) : [];
  const issues = buildReferenceAuditIssues(projectSourceFiles, projectReferences, projectUsages);
  const usedReferences = getUsedReferences(projectReferences, projectUsages);
  const filteredReferences = filterReferences(projectReferences, projectUsages, issues, activeFilter, query);

  if (!projectId) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
        <p className="font-medium text-zinc-800">Selecione um projeto.</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">Referências e arquivos são organizados por projeto.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-300 bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Ingestão de fontes-base</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Arquivos ingeridos ficam como fontes disponíveis. Só viram bibliografia quando forem usados no texto.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={onLinkSourceFiles}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              + Adicionar fonte
            </button>
            <button
              type="button"
              onClick={onLinkProjectDirectory}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Vincular pasta
            </button>
            <button
              type="button"
              onClick={onAddManualReference}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Referência manual
            </button>
          </div>
        </div>

        {!isFileSystemAccessAvailable ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-800">
            Seu navegador não permite vinculação persistente de pastas. Os arquivos serão adicionados como seleção local.
          </p>
        ) : null}

        {importedDocument ? (
          <button
            type="button"
            onClick={() => onRegisterSourceFile({ name: importedDocument.fileName, type: inferSourceFileType(importedDocument.fileType) })}
            className="mt-2 w-full rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            Registrar arquivo importado como fonte-base: {importedDocument.fileName}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onOpenFilePicker}
          className="mt-2 text-[11px] font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
        >
          Importar arquivo para editar no palco
        </button>
      </div>

      <ReferenceFilters activeFilter={activeFilter} onChange={onFilterChange} />

      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
        <Metric label="Fontes" value={projectSourceFiles.length} />
        <Metric label="Usadas" value={usedReferences.length} />
        <Metric label="Pendências" value={issues.filter((issue) => issue.severity !== "info").length} />
      </div>

      {activeFilter === "available_sources" ? (
        <div className="space-y-2">
          {projectSourceFiles.length ? (
            projectSourceFiles.map((sourceFile) => (
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
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
              <p className="font-medium text-zinc-800">Nenhuma fonte disponível.</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Vincule arquivos ou uma pasta do projeto. Isso não adiciona itens à bibliografia automaticamente.
              </p>
            </div>
          )}
        </div>
      ) : activeFilter === "bibliography" ? (
        <ReferenceBibliographyPreview references={usedReferences} />
      ) : activeFilter === "pending" ? (
        <ReferenceAuditPanel issues={issues.filter((issue) => issue.severity !== "info")} />
      ) : filteredReferences.length ? (
        <div className="space-y-2">
          {filteredReferences.map((reference) => (
            <ReferenceCard
              key={reference.id}
              reference={reference}
              usages={projectUsages}
              sourceFile={projectSourceFiles.find((sourceFile) => sourceFile.id === reference.sourceFileId)}
              onRemoveReference={onRemoveReference}
              onRemoveUsage={onRemoveUsage}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
          <p className="font-medium text-zinc-800">Nenhuma referência neste filtro.</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Arquivos anexados só entram aqui quando houver uso real no texto.
          </p>
        </div>
      )}

      {activeFilter !== "bibliography" && activeFilter !== "available_sources" ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Fontes-base disponíveis</p>
          {projectSourceFiles.length ? (
            projectSourceFiles.slice(0, 4).map((sourceFile) => (
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
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-3 text-xs text-zinc-500">
              Nenhuma fonte-base ingerida para este projeto.
            </div>
          )}
        </div>
      ) : null}

      {activeFilter !== "pending" ? <ReferenceAuditPanel issues={issues.slice(0, 4)} /> : null}
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2">
      <p className="text-base font-semibold text-zinc-900">{value}</p>
      <p className="text-zinc-500">{label}</p>
    </div>
  );
}

function filterReferences(
  references: ProjectReference[],
  usages: ReferenceUsage[],
  issues: ReturnType<typeof buildReferenceAuditIssues>,
  activeFilter: ReferenceFilter,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  const issueReferenceIds = new Set(issues.map((issue) => issue.referenceId).filter((id): id is string => Boolean(id)));

  return references.filter((reference) => {
    const referenceUsages = usages.filter((usage) => usage.referenceId === reference.id);
    const usageCount = getReferenceUsageCount(reference.id, usages);
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "used" && usageCount > 0) ||
      (activeFilter === "unused" && usageCount === 0) ||
      (activeFilter === "pending" && issueReferenceIds.has(reference.id)) ||
      (activeFilter === "direct_quotes" && referenceUsages.some((usage) => usage.usageType === "direct_quote")) ||
      (activeFilter === "indirect_quotes" && referenceUsages.some((usage) => usage.usageType === "indirect_quote"));

    if (!matchesFilter) return false;
    if (!normalizedQuery) return true;

    return `${reference.author ?? ""} ${reference.title} ${reference.year ?? ""}`.toLowerCase().includes(normalizedQuery);
  });
}
