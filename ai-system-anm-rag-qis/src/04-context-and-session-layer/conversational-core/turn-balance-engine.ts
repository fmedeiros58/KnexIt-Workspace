import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface TurnBalanceEngineInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface TurnBalanceEngineOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function turnBalanceEngine(input: TurnBalanceEngineInput = {}): TurnBalanceEngineOutput {
  const analysis = analyzeSignalText(input.text);
  const userTurns = countSignalMatches(analysis.normalized, /\b(user:|usuario:)\b/g);
  const assistantTurns = countSignalMatches(analysis.normalized, /\b(assistant:|assistente:)\b/g);
  const totalTurns = userTurns + assistantTurns;

  const balance = totalTurns > 0
    ? 1 - Math.abs(userTurns - assistantTurns) / totalTurns
    : 0.5;

  const inferredScore = clamp01(
    0.24 +
    (balance * 0.54) +
    (Math.min(1, totalTurns / 6) * 0.14),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "turn-balance-engine",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `userTurns=${userTurns}; assistantTurns=${assistantTurns}; balance=${balance.toFixed(2)}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      userTurns,
      assistantTurns,
      totalTurns,
      balance: Number(balance.toFixed(4)),
      hasText: Boolean(analysis.text),
    },
  };
}
