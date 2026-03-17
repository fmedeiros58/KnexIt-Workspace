import { analyzeMemoryText, clamp01, countMemoryMatches, repeatedTokenRatio } from "../memory-signal-utils";

export interface PatternReinforcementEngineInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface PatternReinforcementEngineOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function patternReinforcementEngine(
  input: PatternReinforcementEngineInput = {},
): PatternReinforcementEngineOutput {
  const analysis = analyzeMemoryText(input.text);
  const reinforcementCues = countMemoryMatches(
    analysis.normalized,
    /\b(reforcar|repeat|repetir|padrao|pattern|persist|keep)\b/g,
  );
  const repetition = repeatedTokenRatio(analysis.tokens);

  const inferredScore = clamp01(
    0.24 +
    (Math.min(1, reinforcementCues / 4) * 0.36) +
    (Math.min(1, repetition) * 0.3) +
    (analysis.uniqueRatio * 0.08),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "pattern-reinforcement-engine",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `reinforcementCues=${reinforcementCues}; repetition=${repetition.toFixed(2)}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      reinforcementCues,
      repetition: Number(repetition.toFixed(4)),
      hasText: Boolean(analysis.text),
    },
  };
}
