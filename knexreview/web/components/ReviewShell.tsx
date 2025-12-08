"use client";

import type { ReactNode } from "react";
import type {
  ReviewQuestion,
  GenericSearchStrategy,
  SourceId,
  SearchResultRecord,
  ScreeningRecord,
  ExtractionRecord,
  PrismaCounts,
} from "@/lib/knexreview/types";
import QuestionBuilder from "./QuestionBuilder";
import BooleanQueryBuilder from "./BooleanQueryBuilder";
import SourceSelectionPanel from "./SourceSelectionPanel";
import SearchExecutionPanel from "./SearchExecutionPanel";
import ResultsTable from "./ResultsTable";
import ScreeningPanel from "./ScreeningPanel";
import ExtractionPanel from "./ExtractionPanel";
import PrismaFlowSummary from "./PrismaFlowSummary";

type Stage = "question" | "strategy" | "sources" | "screening" | "extraction";

type Props = {
  stage: Stage;
  onStageChange: (s: Stage) => void;
  question: ReviewQuestion;
  onQuestionChange: (q: ReviewQuestion) => void;
  strategy: GenericSearchStrategy;
  onStrategyChange: (s: GenericSearchStrategy) => void;
  selectedSources: SourceId[];
  onSelectedSourcesChange: (s: SourceId[]) => void;
  results: SearchResultRecord[];
  onRunSearch: () => void;
  searchLoading: boolean;
  searchError: string | null;
  screeningDecisions: ScreeningRecord[];
  onScreeningChange: (r: ScreeningRecord) => void;
  extractions: ExtractionRecord[];
  onExtractionChange: (r: ExtractionRecord) => void;
  prismaCounts: PrismaCounts;
  logs?: ReactNode;
};

export default function ReviewShell({
  stage,
  onStageChange,
  question,
  onQuestionChange,
  strategy,
  onStrategyChange,
  selectedSources,
  onSelectedSourcesChange,
  results,
  onRunSearch,
  searchLoading,
  searchError,
  screeningDecisions,
  onScreeningChange,
  extractions,
  onExtractionChange,
  prismaCounts,
  logs,
}: Props) {
  return (
    <div className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)] bg-white">
      <aside className="border-r border-slate-200 bg-slate-50/70">
        <div className="p-4 space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">KnexReview</h2>
          <p className="text-xs text-slate-600">Revisão sistemática com múltiplas fontes.</p>
        </div>
        <nav className="px-3 pb-4 space-y-1 text-sm">
          {[
            { id: "question", label: "Pergunta" },
            { id: "strategy", label: "Estratégia" },
            { id: "sources", label: "Fontes & Busca" },
            { id: "screening", label: "Screening" },
            { id: "extraction", label: "Extração" },
          ].map((step) => (
            <button
              key={step.id}
              className={`w-full text-left px-3 py-2 rounded-lg ${
                stage === step.id ? "bg-indigo-100 text-indigo-800" : "hover:bg-slate-100 text-slate-700"
              }`}
              onClick={() => onStageChange(step.id as Stage)}
            >
              {step.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="min-h-screen">
        <header className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">KnexReview</p>
            <h1 className="text-xl font-semibold text-slate-900">Revisão sistemática</h1>
          </div>
          {logs}
        </header>

        <div className="p-6 space-y-6">
          {stage === "question" && (
            <QuestionBuilder question={question} onChange={onQuestionChange} />
          )}

          {stage === "strategy" && (
            <BooleanQueryBuilder strategy={strategy} onChange={onStrategyChange} />
          )}

          {stage === "sources" && (
            <div className="space-y-4">
              <SourceSelectionPanel selected={selectedSources} onChange={onSelectedSourcesChange} />
              <SearchExecutionPanel onRun={onRunSearch} loading={searchLoading} error={searchError} />
              <ResultsTable results={results} />
              <PrismaFlowSummary counts={prismaCounts} />
            </div>
          )}

          {stage === "screening" && (
            <ScreeningPanel results={results} decisions={screeningDecisions} onDecision={onScreeningChange} />
          )}

          {stage === "extraction" && (
            <ExtractionPanel results={results} extractions={extractions} onExtraction={onExtractionChange} />
          )}
        </div>
      </main>
    </div>
  );
}

