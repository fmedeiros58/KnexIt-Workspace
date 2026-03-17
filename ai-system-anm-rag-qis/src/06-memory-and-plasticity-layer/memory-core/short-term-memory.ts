import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface ShortTermMemoryInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ShortTermMemoryOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function shortTermMemory(input: ShortTermMemoryInput = {}): ShortTermMemoryOutput {
  const analysis = analyzeMemoryText(input.text);
  const recencyCues = countMemoryMatches(
    analysis.normalized,
    /\b(hoje|agora|recente|recente|ultima|ultimo|recent|today|just|momento)\b/g,
  );
  const referenceCues = countMemoryMatches(
    analysis.normalized,
    /\b(isso|isto|aquele|that|this|it|acima|before)\b/g,
  );

  const inferredScore = clamp01(
    0.24 +
    (Math.min(1, recencyCues / 4) * 0.46) +
    (Math.min(1, referenceCues / 5) * 0.2) +
    (analysis.uniqueRatio * 0.1),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "short-term-memory",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `recencyCues=${recencyCues}; referenceCues=${referenceCues}; uniqueRatio=${analysis.uniqueRatio.toFixed(2)}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      recencyCues,
      referenceCues,
      uniqueRatio: Number(analysis.uniqueRatio.toFixed(4)),
      hasText: Boolean(analysis.text),
    },
  };
}
