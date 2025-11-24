"use client";

import { useMemo } from "react";
import ReviewShell from "./components/ReviewShell";
import { useReviewState } from "./hooks/useReviewState";
import { useSearchRunner } from "./hooks/useSearchRunner";
import { summarizePrisma } from "@/lib/knexreview/screening";
import { updateScreening } from "@/lib/knexreview/screening";
import { saveExtraction } from "@/lib/knexreview/extraction";

export default function KnexReviewPage() {
  const {
    stage,
    setStage,
    question,
    setQuestion,
    strategy,
    setStrategy,
    selectedSources,
    setSelectedSources,
    results,
    setResults,
    screeningDecisions,
    setScreeningDecisions,
    extractions,
    setExtractions,
  } = useReviewState();

  const { run, loading, error } = useSearchRunner();

  const prismaCounts = useMemo(() => summarizePrisma(screeningDecisions), [screeningDecisions]);

  const onRunSearch = async () => {
    const res = await run(strategy, selectedSources);
    setResults(res.results);
  };

  return (
    <ReviewShell
      stage={stage}
      onStageChange={setStage}
      question={question}
      onQuestionChange={setQuestion}
      strategy={strategy}
      onStrategyChange={setStrategy}
      selectedSources={selectedSources}
      onSelectedSourcesChange={setSelectedSources}
      results={results}
      onRunSearch={onRunSearch}
      searchLoading={loading}
      searchError={error}
      screeningDecisions={screeningDecisions}
      onScreeningChange={(rec) => setScreeningDecisions((prev) => updateScreening(prev, rec))}
      extractions={extractions}
      onExtractionChange={(rec) => setExtractions((prev) => saveExtraction(prev, rec))}
      prismaCounts={prismaCounts}
    />
  );
}

