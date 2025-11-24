"use client";

import { useState } from "react";
import type {
  ReviewQuestion,
  GenericSearchStrategy,
  SourceId,
  SearchResultRecord,
  ScreeningRecord,
  ExtractionRecord,
} from "@/lib/knexreview/types";

type Stage = "question" | "strategy" | "sources" | "screening" | "extraction";

export function useReviewState() {
  const [stage, setStage] = useState<Stage>("question");
  const [question, setQuestion] = useState<ReviewQuestion>({ model: "PICO" });
  const [strategy, setStrategy] = useState<GenericSearchStrategy>({
    id: "draft",
    title: "Estratégia inicial",
    groups: [],
    betweenGroupsOperator: "AND",
  });
  const [selectedSources, setSelectedSources] = useState<SourceId[]>(["pubmed", "crossref"]);
  const [results, setResults] = useState<SearchResultRecord[]>([]);
  const [screeningDecisions, setScreeningDecisions] = useState<ScreeningRecord[]>([]);
  const [extractions, setExtractions] = useState<ExtractionRecord[]>([]);

  return {
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
  };
}

