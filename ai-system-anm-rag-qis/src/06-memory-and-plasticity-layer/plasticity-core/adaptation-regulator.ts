import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface AdaptationRegulatorInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface AdaptationRegulatorOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function adaptationRegulator(input: AdaptationRegulatorInput = {}): AdaptationRegulatorOutput {
  const analysis = analyzeMemoryText(input.text);
  const changeCues = countMemoryMatches(
    analysis.normalized,
    /\b(ajuste|adapte|mude|change|adapt|update|novo|new)\b/g,
  );
  const stabilityCues = countMemoryMatches(
    analysis.normalized,
    /\b(manter|estavel|fixo|keep|stable|consistent)\b/g,
  );

  const inferredScore = clamp01(
    0.26 +
    (Math.min(1, changeCues / 4) * 0.4) -
    (Math.min(1, stabilityCues / 4) * 0.16) +
    (Math.min(1, analysis.tokenCount / 30) * 0.08),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "adaptation-regulator",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `changeCues=${changeCues}; stabilityCues=${stabilityCues}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      changeCues,
      stabilityCues,
      hasText: Boolean(analysis.text),
    },
  };
}
