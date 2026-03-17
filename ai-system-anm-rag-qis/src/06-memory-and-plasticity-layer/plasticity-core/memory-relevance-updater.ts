import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface MemoryRelevanceUpdaterInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface MemoryRelevanceUpdaterOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function memoryRelevanceUpdater(input: MemoryRelevanceUpdaterInput = {}): MemoryRelevanceUpdaterOutput {
  const analysis = analyzeMemoryText(input.text);
  const relevanceCues = countMemoryMatches(
    analysis.normalized,
    /\b(relevante|relevancia|important|relevant|pertinente|fit|match)\b/g,
  );
  const irrelevanceCues = countMemoryMatches(
    analysis.normalized,
    /\b(irrelevante|fora do tema|off-topic|not relevant|noise)\b/g,
  );

  const inferredScore = clamp01(
    0.26 +
    (Math.min(1, relevanceCues / 4) * 0.42) -
    (Math.min(1, irrelevanceCues / 3) * 0.2) +
    (Math.min(1, analysis.tokenCount / 26) * 0.08),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "memory-relevance-updater",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `relevanceCues=${relevanceCues}; irrelevanceCues=${irrelevanceCues}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      relevanceCues,
      irrelevanceCues,
      hasText: Boolean(analysis.text),
    },
  };
}
