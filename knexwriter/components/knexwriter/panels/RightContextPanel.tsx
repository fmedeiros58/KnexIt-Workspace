"use client";

/**
 * ============================================================================
 * TÍTULO DO ARQUIVO
 * ============================================================================
 * Produto: KnexWriter
 * Setor: Painéis laterais / Painel direito contextual
 * Arquivo: components/knexwriter/panels/RightContextPanel.tsx
 *
 * ============================================================================
 * OBJETIVO DO COMPONENTE
 * ============================================================================
 * Renderizar o painel lateral direito do KnexWriter.
 *
 * Este componente funciona como container dos painéis de trabalho à direita:
 * - Projetos
 * - Seções
 * - Contextos / análise textual
 *
 * O Shell/Layout principal decide QUANDO este painel aparece.
 * Este componente decide QUAL conteúdo interno aparece conforme a aba ativa.
 *
 * ============================================================================
 */

import {
  Bot,
  ChevronRight,
  FileText,
  FolderOpen,
  Layers3,
  Search,
  X,
} from "lucide-react";
import type { WriterRenderProps } from "../shell/KnexWriterShell";
import { ContextAnalysisPanel } from "./ContextAnalysisPanel";
import { ProjectPanel } from "./ProjectPanel";
import { SectionPanel } from "./SectionPanel";

export type RightContextPanelProps = Pick<
  WriterRenderProps,
  "state" | "actions"
> & {
  className?: string;
};

type RightPanelTab = WriterRenderProps["state"]["writingRightPanelTab"];

const RIGHT_PANEL_TABS: Array<{
  value: RightPanelTab;
  label: string;
  icon: typeof FolderOpen;
}> = [
  {
    value: "projects",
    label: "Projetos",
    icon: FolderOpen,
  },
  {
    value: "sections",
    label: "Seções",
    icon: FileText,
  },
  {
    value: "contexts",
    label: "Contextos",
    icon: Layers3,
  },
];

function getPanelTitle(tab: RightPanelTab) {
  if (tab === "projects") return "Projetos";
  if (tab === "sections") return "Seções";
  return "Contextos";
}

function getPanelDescription(tab: RightPanelTab) {
  if (tab === "projects") {
    return "Gerencie e abra projetos de escrita.";
  }

  if (tab === "sections") {
    return "Organize as seções do projeto ativo.";
  }

  return "Acompanhe análises de recorrência, redundância e progressão textual.";
}

export function RightContextPanel({
  state,
  actions,
  className = "",
}: RightContextPanelProps) {
  const widthPercent = Math.min(
    Math.max(state.writingWorksWidthPercent, 16),
    48,
  );

  const activeTab = state.writingRightPanelTab;

  return (
    <aside
      data-knexwriter-right-context-panel="true"
      className={[
        "relative flex min-h-0 shrink-0 flex-col border-l border-zinc-200 bg-white text-zinc-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width: "100%",
        minWidth: 0,
        maxWidth: "none"
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        title="Redimensionar painel direito"
        className="absolute left-[-3px] top-0 z-20 h-full w-1.5 cursor-col-resize bg-transparent transition hover:bg-blue-300/50"
        onMouseDown={actions.startWritingWorksResize}
      />

      <header className="shrink-0 border-b border-zinc-200 bg-white">
        <div className="flex h-12 items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-zinc-950">
              {getPanelTitle(activeTab)}
            </h2>

            <p className="truncate text-[11px] text-zinc-500">
              {getPanelDescription(activeTab)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              title="Abrir análise contextual"
              aria-label="Abrir análise contextual"
              className={[
                "inline-flex h-8 w-8 items-center justify-center rounded-md transition",
                activeTab === "contexts"
                  ? "bg-blue-50 text-blue-700"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
              ].join(" ")}
              onClick={() => actions.setWritingRightPanelTab("contexts")}
            >
              <Bot className="h-4 w-4" />
            </button>

            <button
              type="button"
              title="Recolher painel direito"
              aria-label="Recolher painel direito"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              onClick={() => actions.setIsWritingWorksCollapsed(true)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="grid grid-cols-3 gap-2 border-t border-zinc-100 px-3 py-2">
          {RIGHT_PANEL_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                className={[
                  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition",
                  isActive
                    ? "bg-zinc-950 text-white shadow-sm"
                    : "bg-transparent text-zinc-700 hover:bg-zinc-100",
                ].join(" ")}
                onClick={() => actions.setWritingRightPanelTab(tab.value)}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-zinc-100 px-3 py-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

            <input
              value={state.writingWorksQuery}
              onChange={(event) =>
                actions.setWritingWorksQuery(event.currentTarget.value)
              }
              placeholder={
                activeTab === "projects"
                  ? "Buscar projeto..."
                  : activeTab === "sections"
                    ? "Buscar seção..."
                    : "Buscar contexto..."
              }
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-8 text-xs text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />

            {state.writingWorksQuery.trim() ? (
              <button
                type="button"
                title="Limpar busca"
                aria-label="Limpar busca"
                className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                onClick={() => actions.setWritingWorksQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "projects" ? (
          <ProjectPanel state={state} actions={actions} />
        ) : null}

        {activeTab === "sections" ? (
          <SectionPanel state={state} actions={actions} />
        ) : null}

        {activeTab === "contexts" ? (
          <ContextAnalysisPanel state={state} actions={actions} />
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-zinc-200 bg-zinc-50 px-4 py-2">
        <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
          <span className="truncate">
            {state.writeSession.hasUnsavedChanges
              ? "Alterações pendentes"
              : "Sessão sincronizada"}
          </span>

          <span className="shrink-0">
            {state.writeSession.isSaving
              ? "Salvando..."
              : state.writeSession.lastSyncedAt
                ? "Atualizado"
                : "Local"}
          </span>
        </div>
      </footer>
    </aside>
  );
}

export default RightContextPanel;