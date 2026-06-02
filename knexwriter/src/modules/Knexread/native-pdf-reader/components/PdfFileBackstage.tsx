"use client";

import type { PdfDocumentSource } from "../types";

type FileBackstageSection =
  | "propriedades"
  | "criar"
  | "abrir"
  | "salvar"
  | "salvar-como"
  | "exportar"
  | "imprimir"
  | "compartilhar"
  | "fechar"
  | "preferencias";

const SECTION_LABELS: Record<FileBackstageSection, string> = {
  propriedades: "Propriedades",
  criar: "Criar",
  abrir: "Abrir",
  salvar: "Salvar",
  "salvar-como": "Salvar como",
  exportar: "Exportar",
  imprimir: "Imprimir",
  compartilhar: "Compartilhar",
  fechar: "Fechar",
  preferencias: "Preferencias",
};

export function PdfFileBackstage({
  sourceName,
  currentPdfFileId,
  recentFiles,
  activeSection,
  onSectionChange,
  onOpenComputer,
  onOpenRecent,
  onCloseReader,
}: {
  sourceName: string;
  currentPdfFileId?: string;
  recentFiles: PdfDocumentSource[];
  activeSection: FileBackstageSection;
  onSectionChange: (section: FileBackstageSection) => void;
  onOpenComputer: () => void;
  onOpenRecent?: (pdfFileId: string) => void;
  onCloseReader: () => void;
}) {
  return (
    <div className="flex h-full min-h-full w-full min-w-0 flex-1 overflow-hidden bg-zinc-100">
      <aside className="h-full w-44 shrink-0 border-r border-zinc-200 bg-zinc-200/70 px-2 py-2">
        {(Object.keys(SECTION_LABELS) as FileBackstageSection[]).map((sectionId) => {
          const active = sectionId === activeSection;
          return (
            <button
              key={sectionId}
              type="button"
              onClick={() => onSectionChange(sectionId)}
              className={`mb-1 flex w-full items-center rounded px-3 py-2 text-left text-sm font-medium ${
                active
                  ? "border-l-4 border-sky-600 bg-sky-100 text-zinc-950"
                  : "text-zinc-950 hover:bg-zinc-300/70"
              }`}
            >
              {SECTION_LABELS[sectionId]}
            </button>
          );
        })}
      </aside>

      <section className="h-full w-56 shrink-0 border-r border-zinc-200 bg-zinc-100 px-3 py-3">
        <p className="mb-3 text-2xl font-light text-zinc-800">Abrir</p>
        <button
          type="button"
          className="mb-2 flex w-full items-center rounded bg-sky-100 px-3 py-2 text-left text-sm font-medium text-zinc-950"
        >
          Documentos Recentes
        </button>
        <button
          type="button"
          onClick={onOpenComputer}
          className="mb-2 flex w-full items-center rounded px-3 py-2 text-left text-sm text-zinc-950 hover:bg-zinc-200"
        >
          Computador
        </button>
        <button
          type="button"
          className="mb-2 flex w-full items-center rounded px-3 py-2 text-left text-sm text-zinc-950 hover:bg-zinc-200"
        >
          Adicionar um lugar
        </button>
        <button
          type="button"
          onClick={onCloseReader}
          className="mt-6 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 hover:bg-zinc-50"
        >
          Fechar leitor
        </button>
      </section>

      <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-zinc-100 px-4 py-3">
        <p className="mb-3 text-xl font-light text-zinc-800">Documentos Recentes</p>
        <p className="mb-3 text-xs text-zinc-500">Local • {sourceName}</p>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="max-w-3xl divide-y divide-zinc-200 border-t border-zinc-200">
            {(recentFiles.length ? recentFiles : []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenRecent?.(item.id)}
                disabled={!onOpenRecent}
                className="block w-full py-2 text-left transition hover:bg-zinc-200/50 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <p className="truncate text-sm text-zinc-950">
                  {item.fileName}
                  {item.id === currentPdfFileId ? " (atual)" : ""}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {item.filePath || "Arquivo local salvo no workspace do KnexWriter"}
                </p>
              </button>
            ))}
            {!recentFiles.length ? (
              <article className="py-5 text-sm text-zinc-500">
                Nenhum documento recente encontrado para este projeto.
              </article>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
