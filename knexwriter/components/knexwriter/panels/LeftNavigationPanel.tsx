"use client";

/**
 * ============================================================================
 * TÍTULO DO ARQUIVO
 * ============================================================================
 * Produto: KnexWriter
 * Setor: Painéis laterais / Navegação textual
 * Arquivo: components/knexwriter/panels/LeftNavigationPanel.tsx
 *
 * ============================================================================
 * OBJETIVO DO COMPONENTE
 * ============================================================================
 * Renderizar o painel lateral esquerdo do KnexWriter.
 *
 * Este painel NÃO deve ser renderizado diretamente pelo Stage.
 * Ele deve ser chamado pelo Shell/Layout principal somente quando o estado
 * de navegação textual estiver ativo.
 *
 * Responsabilidades:
 * - Navegação por títulos
 * - Navegação por páginas
 * - Acesso à camada de IA/análise textual
 * - Busca interna da navegação
 * - Fechamento do painel esquerdo
 * - Redimensionamento lateral, quando o Shell fornecer a action
 *
 * ============================================================================
 */

import {
  Bot,
  ChevronLeft,
  FileText,
  Heading1,
  Layers3,
  Search,
  Sparkles,
} from "lucide-react";
import type { WriterRenderProps } from "../shell/KnexWriterShell";

export type LeftNavigationPanelProps = Pick<
  WriterRenderProps,
  "state" | "actions"
> & {
  className?: string;
};

type WritingNavTab = WriterRenderProps["state"]["writingNavTab"];
type HeadingItem = WriterRenderProps["state"]["writingFilteredHeadings"][number];

const NAV_TABS: Array<{
  value: WritingNavTab;
  label: string;
}> = [
  {
    value: "titles",
    label: "Títulos",
  },
  {
    value: "pages",
    label: "Páginas",
  },
  {
    value: "results",
    label: "IA",
  },
];

function getHeadingIndentClass(level: number) {
  if (level <= 1) return "pl-2";
  if (level === 2) return "pl-5";
  if (level === 3) return "pl-8";
  return "pl-10";
}

function getHeadingIconSize(level: number) {
  if (level <= 1) return "h-4 w-4";
  if (level === 2) return "h-3.5 w-3.5";
  return "h-3 w-3";
}

function formatFillRatio(value: number | undefined) {
  if (!Number.isFinite(value)) return "0%";

  return `${Math.round(Math.min(Math.max(value ?? 0, 0), 1) * 100)}%`;
}

export function LeftNavigationPanel({
  state,
  actions,
  className = "",
}: LeftNavigationPanelProps) {
  const widthPercent = Math.min(
    Math.max(state.writingNavWidthPercent, 12),
    48,
  );

  return (
    <aside
      data-knexwriter-left-navigation-panel="true"
      className={[
        "relative flex min-h-0 shrink-0 flex-col border-r border-zinc-200 bg-white text-zinc-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width: "100%",
        minWidth: 0,
        maxWidth: "none",
    }}
    >
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-200 px-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-zinc-900">
            Navegação textual
          </h2>
        </div>

        <button
          type="button"
          aria-label="Fechar navegação textual"
          title="Fechar navegação textual"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          onClick={() => actions.setIsWritingNavCollapsed(true)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </header>

      <div className="shrink-0 border-b border-zinc-200 px-2 py-2">
        <div className="grid grid-cols-3 gap-2">
          {NAV_TABS.map((tab) => {
            const isActive = state.writingNavTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                className={[
                  "h-8 rounded-md px-2 text-xs font-semibold transition",
                  isActive
                    ? "bg-zinc-950 text-white shadow-sm"
                    : "bg-transparent text-zinc-700 hover:bg-zinc-100",
                ].join(" ")}
                onClick={() => actions.setWritingNavTab(tab.value)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-b border-zinc-200 px-2 py-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

          <input
            value={state.writingNavQuery}
            onChange={(event) =>
              actions.setWritingNavQuery(event.currentTarget.value)
            }
            placeholder={
              state.writingNavTab === "pages"
                ? "Buscar página..."
                : state.writingNavTab === "results"
                  ? "Buscar análise..."
                  : "Buscar..."
            }
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {state.writingNavTab === "titles" ? (
          <TitlesNavigationView state={state} actions={actions} />
        ) : null}

        {state.writingNavTab === "pages" ? (
          <PagesNavigationView state={state} actions={actions} />
        ) : null}

        {state.writingNavTab === "results" ? (
          <AiNavigationView state={state} actions={actions} />
        ) : null}
      </div>

      <div className="shrink-0 border-t border-zinc-200 px-3 py-2">
        <p className="truncate text-[11px] text-zinc-500">
          {state.writingTitle || "Documento sem título"}
        </p>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        title="Redimensionar navegação"
        className="absolute right-[-3px] top-0 z-20 h-full w-1.5 cursor-col-resize bg-transparent transition hover:bg-blue-300/50"
        onMouseDown={actions.startWritingNavResize}
      />
    </aside>
  );
}

function TitlesNavigationView({
  state,
  actions,
}: Pick<WriterRenderProps, "state" | "actions">) {
  const headings = state.writingFilteredHeadings;

  if (!headings.length) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-3">
        <p className="text-sm font-semibold text-zinc-800">
          Nenhum título encontrado ainda.
        </p>

        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Digite títulos no editor para navegar pela estrutura.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {headings.map((heading: HeadingItem, index: number) => (
        <button
          key={`${heading.level}-${heading.text}-${index}`}
          type="button"
          className={[
            "flex w-full items-start gap-2 rounded-md py-2 pr-2 text-left text-sm transition hover:bg-zinc-100",
            getHeadingIndentClass(heading.level),
          ].join(" ")}
          onClick={() => actions.jumpToWritingHeading(heading.text)}
          title={heading.text}
        >
          <Heading1
            className={[
              "mt-0.5 shrink-0 text-zinc-400",
              getHeadingIconSize(heading.level),
            ].join(" ")}
          />

          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 font-medium leading-snug text-zinc-800">
              {heading.text}
            </span>

            <span className="mt-0.5 block text-[11px] text-zinc-400">
              Título nível {heading.level}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function PagesNavigationView({
  state,
  actions,
}: Pick<WriterRenderProps, "state" | "actions">) {
  const pages = state.writingPages.length
    ? state.writingPages
    : Array.from(
        { length: Math.max(1, state.writingPageCount) },
        (_item, index) => index + 1,
      );

  if (!pages.length) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-3">
        <p className="text-sm font-semibold text-zinc-800">
          Nenhuma página encontrada.
        </p>

        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          A paginação aparecerá aqui assim que o documento for renderizado.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {pages.map((pageNumber: number, index: number) => {
        const isActive = state.writingActivePage === pageNumber;
        const fillRatio = state.writingPageFillRatios[index];

        return (
          <button
            key={`writer-page-${pageNumber}`}
            type="button"
            className={[
              "group rounded-lg border p-2 text-left transition",
              isActive
                ? "border-blue-300 bg-blue-50"
                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
            ].join(" ")}
            onClick={() => actions.jumpToWritingPage(pageNumber)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
                <FileText className="h-4 w-4 text-zinc-400" />
                Página {pageNumber}
              </span>

              {isActive ? (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  ativa
                </span>
              ) : null}
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-zinc-400 transition-all group-hover:bg-zinc-500"
                style={{
                  width: formatFillRatio(fillRatio),
                }}
              />
            </div>

            <p className="mt-1 text-[11px] text-zinc-500">
              Ocupação: {formatFillRatio(fillRatio)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function AiNavigationView({
  state,
  actions,
}: Pick<WriterRenderProps, "state" | "actions">) {
  const hasContextClusters = state.contextClusters.length > 0;
  const isThinking = state.writingStatus === "thinking";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
            <Bot className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-800">
              Navegação por IA
            </p>

            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Use esta área para acessar análises de recorrência, contexto,
              redundância, progressão textual e sugestões de reorganização.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
          onClick={() => {
            actions.setIsWritingWorksCollapsed(false);
            actions.setWritingRightPanelTab("contexts");
          }}
        >
          <Layers3 className="h-4 w-4" />
          Abrir análise contextual
        </button>

        <button
          type="button"
          disabled={isThinking}
          className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() =>
            void actions.sendWritingAssist(
              "Analise a estrutura do documento atual e apresente uma navegação por ideias centrais, recorrências, lacunas argumentativas e pontos que merecem reorganização.",
            )
          }
        >
          <Sparkles className="h-4 w-4" />
          {isThinking ? "Analisando..." : "Gerar leitura estrutural"}
        </button>
      </div>

      {hasContextClusters ? (
        <div className="space-y-2">
          {state.contextClusters.slice(0, 8).map((cluster) => (
            <button
              key={cluster.id}
              type="button"
              className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-left transition hover:bg-zinc-50"
              onClick={() => {
                actions.setIsWritingWorksCollapsed(false);
                actions.setWritingRightPanelTab("contexts");
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-800">
                  {cluster.label}
                </p>

                <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                  {cluster.occurrenceCount}
                </span>
              </div>

              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-zinc-500">
                {cluster.summary}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-3">
          <p className="text-sm font-semibold text-zinc-800">
            Nenhuma análise disponível ainda.
          </p>

          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Acione a IA para que os resultados apareçam nesta navegação.
          </p>
        </div>
      )}
    </div>
  );
}

export default LeftNavigationPanel;