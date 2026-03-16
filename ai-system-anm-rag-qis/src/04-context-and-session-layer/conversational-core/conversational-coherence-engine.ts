import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface ConversationalCoherenceEngineInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ConversationalCoherenceEngineOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function conversationalCoherenceEngine(
  input: ConversationalCoherenceEngineInput = {},
): ConversationalCoherenceEngineOutput {
  const analysis = analyzeSignalText(input.text);
  const connectiveHits = countSignalMatches(
    analysis.normalized,
    /\b(portanto|entao|logo|porque|contudo|however|therefore|because|so)\b/g,
  );
  const ambiguityHits = countSignalMatches(
    analysis.normalized,
    /\b(isso|isto|aquilo|coisa|it|that|this|something)\b/g,
  );
  const contradictionHits = countSignalMatches(
    analysis.normalized,
    /\b(mas|porem|contradiz|inconsistente|but|however|contradiction)\b/g,
  );

  const inferredScore = clamp01(
    0.3 +
    (Math.min(1, connectiveHits / 4) * 0.34) +
    (analysis.uniqueRatio * 0.18) -
    (Math.min(1, ambiguityHits / 5) * 0.14) -
    (Math.min(1, contradictionHits / 4) * 0.12),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "conversational-coherence-engine",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `connectiveHits=${connectiveHits}; ambiguity=${ambiguityHits}; contradiction=${contradictionHits}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      connectiveHits,
      ambiguityHits,
      contradictionHits,
      hasText: Boolean(analysis.text),
    },
  };
}
