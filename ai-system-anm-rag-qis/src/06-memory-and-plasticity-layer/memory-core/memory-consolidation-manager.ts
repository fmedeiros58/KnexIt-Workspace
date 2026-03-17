import { analyzeMemoryText, clamp01, countMemoryMatches, repeatedTokenRatio } from "../memory-signal-utils";

export interface MemoryConsolidationManagerInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface MemoryConsolidationManagerOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function memoryConsolidationManager(
  input: MemoryConsolidationManagerInput = {},
): MemoryConsolidationManagerOutput {
  const analysis = analyzeMemoryText(input.text);
  const reinforcementCues = countMemoryMatches(
    analysis.normalized,
    /\b(repetir|reforcar|manter|persistir|reinforce|keep|persist|stable)\b/g,
  );
  const conflictCues = countMemoryMatches(
    analysis.normalized,
    /\b(conflito|contradicao|inconsistente|muda|conflict|contradiction|drift)\b/g,
  );
  const repetition = repeatedTokenRatio(analysis.tokens);

  const inferredScore = clamp01(
    0.28 +
    (Math.min(1, reinforcementCues / 4) * 0.32) +
    (Math.min(1, repetition) * 0.24) -
    (Math.min(1, conflictCues / 3) * 0.2),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "memory-consolidation-manager",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `reinforcement=${reinforcementCues}; conflict=${conflictCues}; repetition=${repetition.toFixed(2)}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      reinforcementCues,
      conflictCues,
      repetition: Number(repetition.toFixed(4)),
      hasText: Boolean(analysis.text),
    },
  };
}
