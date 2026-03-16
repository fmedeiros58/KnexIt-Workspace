import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface SessionManagerInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface SessionManagerOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function sessionManager(input: SessionManagerInput = {}): SessionManagerOutput {
  const analysis = analyzeSignalText(input.text);
  const userTurns = countSignalMatches(analysis.normalized, /\b(user:|usuario:)\b/g);
  const assistantTurns = countSignalMatches(analysis.normalized, /\b(assistant:|assistente:)\b/g);
  const continuityCues = countSignalMatches(analysis.normalized, /\b(continuar|como antes|mesmo tema|continue|as before|same topic)\b/g);
  const resetCues = countSignalMatches(analysis.normalized, /\b(novo assunto|mudar tema|reset|start over|from scratch)\b/g);

  const turnSignal = Math.min(1, (userTurns + assistantTurns) / 6);
  const stabilitySignal = clamp01(0.6 + (continuityCues * 0.12) - (resetCues * 0.15));

  const inferredScore = clamp01(
    0.24 +
    (turnSignal * 0.4) +
    (stabilitySignal * 0.26) +
    (analysis.uniqueRatio * 0.1),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "session-manager",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `userTurns=${userTurns}; assistantTurns=${assistantTurns}; stability=${stabilitySignal.toFixed(2)}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      userTurns,
      assistantTurns,
      continuityCues,
      resetCues,
      stabilitySignal: Number(stabilitySignal.toFixed(4)),
      hasText: Boolean(analysis.text),
    },
  };
}
