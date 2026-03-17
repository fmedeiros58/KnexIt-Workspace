import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface ContextualResonanceDetectorInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ContextualResonanceDetectorOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function contextualResonanceDetector(
  input: ContextualResonanceDetectorInput = {},
): ContextualResonanceDetectorOutput {
  const analysis = analyzeMemoryText(input.text);
  const contextRefs = countMemoryMatches(
    analysis.normalized,
    /\b(contexto|como dito|acima|abaixo|this context|that context|as discussed)\b/g,
  );
  const alignmentCues = countMemoryMatches(
    analysis.normalized,
    /\b(alinha|coerente|consistente|align|coherent|consistent|match)\b/g,
  );

  const inferredScore = clamp01(
    0.24 +
    (Math.min(1, contextRefs / 4) * 0.4) +
    (Math.min(1, alignmentCues / 4) * 0.28) +
    (analysis.uniqueRatio * 0.08),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "contextual-resonance-detector",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `contextRefs=${contextRefs}; alignmentCues=${alignmentCues}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      contextRefs,
      alignmentCues,
      hasText: Boolean(analysis.text),
    },
  };
}
