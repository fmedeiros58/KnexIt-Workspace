import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface DynamicWeightAdjusterInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface DynamicWeightAdjusterOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function dynamicWeightAdjuster(input: DynamicWeightAdjusterInput = {}): DynamicWeightAdjusterOutput {
  const analysis = analyzeMemoryText(input.text);
  const emphasisCues = countMemoryMatches(
    analysis.normalized,
    /\b(importante|prioridade|crucial|critical|priority|must|chave|key)\b/g,
  );
  const downgradeCues = countMemoryMatches(
    analysis.normalized,
    /\b(secundario|menos relevante|optional|low priority|later)\b/g,
  );

  const inferredScore = clamp01(
    0.24 +
    (Math.min(1, emphasisCues / 4) * 0.44) -
    (Math.min(1, downgradeCues / 3) * 0.18) +
    (analysis.uniqueRatio * 0.1),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "dynamic-weight-adjuster",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `emphasisCues=${emphasisCues}; downgradeCues=${downgradeCues}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      emphasisCues,
      downgradeCues,
      hasText: Boolean(analysis.text),
    },
  };
}
