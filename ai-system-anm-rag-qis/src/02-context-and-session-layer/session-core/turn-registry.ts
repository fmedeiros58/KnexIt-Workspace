import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface TurnRegistryInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface TurnRegistryOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function turnRegistry(input: TurnRegistryInput = {}): TurnRegistryOutput {
  const analysis = analyzeSignalText(input.text);
  const userMarkers = countSignalMatches(analysis.normalized, /\b(user:|usuario:)\b/g);
  const assistantMarkers = countSignalMatches(analysis.normalized, /\b(assistant:|assistente:)\b/g);
  const turnWords = countSignalMatches(analysis.normalized, /\b(turno|turn|mensagem|message)\b/g);
  const inferredTurnCount = Math.max(userMarkers + assistantMarkers, turnWords);

  const inferredScore = clamp01(
    0.22 +
    (Math.min(1, inferredTurnCount / 6) * 0.54) +
    (Math.min(1, analysis.tokenCount / 24) * 0.16),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "turn-registry",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `turns=${inferredTurnCount}; userMarkers=${userMarkers}; assistantMarkers=${assistantMarkers}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      inferredTurnCount,
      userMarkers,
      assistantMarkers,
      turnWords,
      hasText: Boolean(analysis.text),
    },
  };
}
