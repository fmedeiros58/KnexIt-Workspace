"use client";

import {
  Columns2,
  FileCog,
  FileOutput,
  FilePlus2,
  FileText,
  Files,
  MoveRight,
  Rows3,
  Square,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PdfDocumentSource } from "../types";

type ToolShortcut = {
  id: string;
  title: string;
  description: string;
  iconBgColor: string;
  cta: string;
  icon: LucideIcon;
};

const TOOL_SHORTCUTS: ToolShortcut[] = [
  {
    id: "edit-pdf",
    title: "Editar PDF",
    description: "Editar o documento e formatar o texto",
    iconBgColor: "#5aa2ee",
    cta: "Usar agora",
    icon: FileCog,
  },
  {
    id: "face-to-face",
    title: "Frente a Frente",
    description: "Visualizar duas páginas lado a lado",
    iconBgColor: "#27bbb8",
    cta: "Usar agora",
    icon: Columns2,
  },
  {
    id: "continuous",
    title: "Contínua",
    description: "Exibir páginas com rolagem contínua",
    iconBgColor: "#7ec836",
    cta: "Usar agora",
    icon: Rows3,
  },
  {
    id: "single-page",
    title: "Página Única",
    description: "Exibir uma página de cada vez",
    iconBgColor: "#f3a93b",
    cta: "Usar agora",
    icon: Square,
  },
  {
    id: "side-by-side",
    title: "Lado a Lado Contínuo",
    description: "Visualizar páginas lado a lado com rolagem contínua",
    iconBgColor: "#e78cc8",
    cta: "Usar agora",
    icon: Columns2,
  },
  {
    id: "create-pdf",
    title: "Criar PDF",
    description: "Criar PDF a partir de outros formatos",
    iconBgColor: "#b086f6",
    cta: "Usar agora",
    icon: FilePlus2,
  },
  {
    id: "merge-pdf",
    title: "Mesclar PDF",
    description: "Mesclar vários arquivos em um único PDF",
    iconBgColor: "#f2b86b",
    cta: "Usar agora",
    icon: Files,
  },
  {
    id: "move-pages",
    title: "Mover páginas de PDF",
    description: "Criar novo PDF a partir de páginas do PDF existente",
    iconBgColor: "#c0b323",
    cta: "Usar agora",
    icon: MoveRight,
  },
  {
    id: "export-pdf",
    title: "Exportar PDF",
    description: "Exportar conteúdo do PDF para outros formatos",
    iconBgColor: "#9f92f6",
    cta: "Usar agora",
    icon: FileOutput,
  },
];

function formatRecentDate(input?: string) {
  if (!input) return "-";
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
}

export function PdfHomePage({
  recentFiles,
  currentPdfFileId,
  onOpenComputer,
  onOpenRecent,
}: {
  recentFiles: PdfDocumentSource[];
  currentPdfFileId?: string;
  onOpenComputer: () => void;
  onOpenRecent: (pdfFileId: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-zinc-100">
      <aside className="flex w-48 shrink-0 flex-col border-r border-zinc-200 bg-zinc-200/60 p-2">
        <button
          type="button"
          className="mb-1 flex w-full items-center rounded bg-zinc-300/70 px-3 py-2 text-left text-sm font-semibold text-violet-700"
        >
          Página Inicial
        </button>
        <button
          type="button"
          className="mb-3 flex w-full items-center rounded px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-300/60"
        >
          Tutoriais em Vídeo
        </button>
        <button
          type="button"
          onClick={onOpenComputer}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
        >
          Abrir Arquivo
        </button>
      </aside>

      <section className="min-w-0 flex flex-1 flex-col overflow-hidden px-5 py-4">
        <header className="mb-5 shrink-0 border-b border-zinc-200 pb-4">
          <h2 className="text-lg font-semibold text-zinc-800">
            Assistente de Ferramentas{" "}
            <span className="text-sm font-normal text-zinc-500">
              (Ferramentas frequentemente usadas)
            </span>
          </h2>
          <div className="mt-4 overflow-x-auto">
            <div className="flex min-w-max items-stretch">
              {TOOL_SHORTCUTS.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <article
                    key={tool.id}
                    className={`w-[220px] px-3 py-2 ${
                      index < TOOL_SHORTCUTS.length - 1 ? "border-r border-zinc-200" : ""
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: tool.iconBgColor }}
                      >
                        <Icon size={16} />
                      </span>
                      <h3 className="text-sm font-semibold text-zinc-800">{tool.title}</h3>
                    </div>
                    <p className="min-h-[34px] text-xs text-zinc-600">{tool.description}</p>
                    <button
                      type="button"
                      onClick={onOpenComputer}
                      className="mt-2 text-xs font-medium text-blue-700 hover:underline"
                    >
                      {tool.cta}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-800">Recentes</h3>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded border border-zinc-200 bg-white">
            <div className="grid grid-cols-[minmax(0,1fr)_280px] border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <span>Nome</span>
              <span className="pr-2 text-right">Data de Modificação</span>
            </div>

            <div className="h-full overflow-auto">
              {recentFiles.length ? (
                recentFiles.slice(0, 30).map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => onOpenRecent(file.id)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_280px] grid-rows-[20px_16px] items-start gap-x-4 gap-y-0 border-b border-zinc-100 px-4 py-2 text-left text-sm transition hover:bg-zinc-50"
                  >
                    <p className="col-start-1 row-start-1 min-w-0 truncate leading-[20px] font-medium text-zinc-800">
                      {file.fileName}
                      {file.id === currentPdfFileId ? " (aberto)" : ""}
                    </p>
                    <p className="col-start-1 row-start-2 min-w-0 truncate leading-4 text-xs text-zinc-500">
                      {file.filePath || "Fonte PDF do projeto KnexWriter"}
                    </p>
                    <p className="col-start-2 row-start-2 self-start pr-2 text-right text-xs leading-4 whitespace-nowrap text-zinc-600">
                      {formatRecentDate(file.lastOpenedAt ?? file.updatedAt ?? file.addedAt)}
                    </p>
                  </button>
                ))
              ) : (
                <p className="px-4 py-5 text-sm text-zinc-500">
                  Nenhum PDF recente encontrado neste projeto.
                </p>
              )}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
