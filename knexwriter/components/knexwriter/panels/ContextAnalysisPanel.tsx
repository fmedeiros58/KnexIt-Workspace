"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Bot,
  Layers3,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import type { WriterRenderProps } from "../shell/KnexWriterShell";

export type ContextAnalysisPanelProps = Pick<
  WriterRenderProps,
  "state" | "actions"
> & {
  className?: string;
  onRequestAnalysis?: () => void;
};

type ContextCluster = WriterRenderProps["state"]["contextClusters"][number];
type ContextOccurrence = ContextCluster["occurrences"][number];

const ANALYSIS_KIND_LABEL: Record<string, string> = {
  literal_repetition: "Repetição literal",
  semantic_repetition: "Repetição semântica",
  redundancy: "Redundância",
  prolixity: "Prolixidade",
  incoherence: "Incoerência",
  contradiction: "Contradição",
  useful_recall: "Retomada útil",
  meaning_shift: "Deslocamento de sentido",
  low_argumentative_progression: "Baixa progressão argumentativa",
};

const OCCURRENCE_ROLE_LABEL: Record<string, string> = {
  primary: "Menção primária",
  secondary: "Menção secundária",
  tertiary: "Menção terciária",
  quaternary: "Menção quaternária",
  other: "Outra ocorrência",
};

const SEVERITY_LABEL: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

function getSeverityClass(severity?: string) {
  if (severity === "high") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (severity === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-sky-200 bg-sky-50 text-sky-700";
}

function getSeverityLabel(severity?: string) {
  if (!severity) return "Baixa";

  return SEVERITY_LABEL[severity] ?? severity;
}

function getAnalysisKindLabel(kind?: string) {
  if (!kind) return "Ocorrência textual";

  return ANALYSIS_KIND_LABEL[kind] ?? kind;
}

function getOccurrenceRoleLabel(role?: string) {
  if (!role) return "Ocorrência";

  return OCCURRENCE_ROLE_LABEL[role] ?? role;
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function clusterMatchesQuery(cluster: ContextCluster, query: string) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) return true;

  const searchableClusterText = normalizeSearchText(
    [
      cluster.label,
      cluster.summary,
      cluster.severity,
      String(cluster.occurrenceCount),
      ...cluster.occurrences.flatMap((occurrence: ContextOccurrence) => [
        occurrence.excerpt,
        occurrence.suggestion ?? "",
        occurrence.classification,
        occurrence.role,
        occurrence.severity,
        occurrence.lineStart ? `linha ${occurrence.lineStart}` : "",
        occurrence.lineEnd ? `linha ${occurrence.lineEnd}` : "",
      ]),
    ].join(" "),
  );

  return searchableClusterText.includes(normalizedQuery);
}

const DEFAULT_CONTEXT_ANALYSIS_PROMPT = [
  "Analise o documento atual do KnexWriter.",
  "Identifique repetições literais, repetições semânticas, redundâncias, prolixidade, incoerências, contradições, retomadas úteis de ideias, deslocamentos de sentido e baixa progressão argumentativa.",
  "Organize o resultado em agrupamentos de contexto, com severidade, ocorrência, trecho e sugestão objetiva de melhoria.",
].join(" ");

export function ContextAnalysisPanel({
  state,
  actions,
  className = "",
  onRequestAnalysis,
}: ContextAnalysisPanelProps) {
  const query = state.writingWorksQuery;

  const filteredClusters = useMemo(() => {
    return state.contextClusters.filter((cluster: ContextCluster) =>
      clusterMatchesQuery(cluster, query),
    );
  }, [state.contextClusters, query]);

  const totalOccurrences = useMemo(() => {
    return filteredClusters.reduce(
      (total: number, cluster: ContextCluster) =>
        total + cluster.occurrenceCount,
      0,
    );
  }, [filteredClusters]);

  const hasClusters = filteredClusters.length > 0;
  const hasQuery = query.trim().length > 0;

  const isAnalyzing =
    state.writingStatus === "thinking" ||
    state.analysisStatusLabel.toLowerCase().includes("analisando");

  const handleRequestAnalysis = () => {
    if (onRequestAnalysis) {
      onRequestAnalysis();
      return;
    }

    void actions.sendWritingAssist(DEFAULT_CONTEXT_ANALYSIS_PROMPT);
  };

  return (
    <section
      data-knexwriter-context-analysis-panel="true"
      className={[
        "flex h-full min-h-0 flex-col bg-white text-zinc-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="shrink-0 border-b border-zinc-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Análise contextual
            </p>

            <h2 className="mt-1 flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <Layers3 className="h-4 w-4 text-zinc-500" />
              Contextos e recorrências
            </h2>
          </div>

          <span
            className={[
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              isAnalyzing
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-zinc-200 bg-zinc-50 text-zinc-600",
            ].join(" ")}
          >
            {state.analysisStatusLabel}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-[11px] font-medium text-zinc-500">
              Agrupamentos
            </p>
            <p className="mt-0.5 text-lg font-semibold text-zinc-950">
              {filteredClusters.length}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-[11px] font-medium text-zinc-500">
              Ocorrências
            </p>
            <p className="mt-0.5 text-lg font-semibold text-zinc-950">
              {totalOccurrences}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={state.writingWorksQuery}
              onChange={(event) =>
                actions.setWritingWorksQuery(event.currentTarget.value)
              }
              placeholder="Buscar em contextos..."
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <button
            type="button"
            onClick={handleRequestAnalysis}
            disabled={isAnalyzing}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Solicitar análise contextual"
          >
            {isAnalyzing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Analisar
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {state.analysisError ? (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{state.analysisError}</p>
            </div>
          </div>
        ) : null}

        {!hasClusters ? (
          <EmptyContextAnalysisState
            hasQuery={hasQuery}
            isAnalyzing={isAnalyzing}
            onRequestAnalysis={handleRequestAnalysis}
          />
        ) : (
          <div className="space-y-3">
            {filteredClusters.map((cluster: ContextCluster) => (
              <ContextClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyContextAnalysisState({
  hasQuery,
  isAnalyzing,
  onRequestAnalysis,
}: {
  hasQuery: boolean;
  isAnalyzing: boolean;
  onRequestAnalysis: () => void;
}) {
  if (hasQuery) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
        <p className="font-semibold text-zinc-800">
          Nenhum contexto encontrado para a busca.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Tente outro termo ou limpe a busca para visualizar todos os agrupamentos
          já identificados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
            <Bot className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-zinc-800">
              Nenhuma análise contextual registrada ainda.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Solicite uma análise para mapear repetições, redundâncias,
              incoerências, retomadas úteis e deslocamentos de sentido no texto.
            </p>

            <button
              type="button"
              onClick={onRequestAnalysis}
              disabled={isAnalyzing}
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAnalyzing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Iniciar análise
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600">
        <p className="font-semibold text-zinc-800">Preparado para detectar:</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Repetição literal e semântica</li>
          <li>Redundância e prolixidade</li>
          <li>Incoerência e contradição</li>
          <li>Retomada útil de ideias</li>
          <li>Baixa progressão argumentativa</li>
        </ul>
      </div>
    </div>
  );
}

function ContextClusterCard({ cluster }: { cluster: ContextCluster }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug text-zinc-900">
            {cluster.label}
          </h3>

          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            {cluster.summary}
          </p>
        </div>

        <span
          className={[
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            getSeverityClass(cluster.severity),
          ].join(" ")}
        >
          {getSeverityLabel(cluster.severity)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-2">
        <p className="text-[11px] font-medium text-zinc-500">
          Ocorrências: {cluster.occurrenceCount}
        </p>

        <p className="text-[11px] text-zinc-400">
          {cluster.occurrences.length} item(ns) listados
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {cluster.occurrences.map((occurrence: ContextOccurrence) => (
          <ContextOccurrenceCard key={occurrence.id} occurrence={occurrence} />
        ))}
      </div>
    </article>
  );
}

function ContextOccurrenceCard({
  occurrence,
}: {
  occurrence: ContextOccurrence;
}) {
  const lineLabel =
    occurrence.lineStart && occurrence.lineEnd
      ? `Linhas ${occurrence.lineStart}-${occurrence.lineEnd}`
      : occurrence.lineStart
        ? `Linha ${occurrence.lineStart}`
        : null;

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-700">
          {getOccurrenceRoleLabel(occurrence.role)}
        </span>

        <span
          className={[
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            getSeverityClass(occurrence.severity),
          ].join(" ")}
        >
          {getSeverityLabel(occurrence.severity)}
        </span>
      </div>

      <p className="mt-1 text-[11px] text-zinc-500">
        {getAnalysisKindLabel(occurrence.classification)}
        {lineLabel ? ` · ${lineLabel}` : ""}
      </p>

      <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-zinc-600">
        {occurrence.excerpt}
      </p>

      {occurrence.suggestion ? (
        <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-2 py-1.5">
          <p className="text-xs font-medium leading-relaxed text-blue-800">
            Sugestão: {occurrence.suggestion}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default ContextAnalysisPanel;