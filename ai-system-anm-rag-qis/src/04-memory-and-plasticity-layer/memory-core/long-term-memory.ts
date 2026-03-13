import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface LongTermMemoryInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface LongTermMemoryOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function longTermMemory(input: LongTermMemoryInput = {}): LongTermMemoryOutput {
  const analysis = analyzeMemoryText(input.text);
  const persistenceCues = countMemoryMatches(
    analysis.normalized,
    /\b(sempre|geralmente|habitual|historico|historical|always|usually|default|preferencia)\b/g,
  );
  const profileCues = countMemoryMatches(
    analysis.normalized,
    /\b(usuario|perfil|profile|preference|gosto|costumo)\b/g,
  );

  const inferredScore = clamp01(
    0.22 +
    (Math.min(1, persistenceCues / 3) * 0.48) +
    (Math.min(1, profileCues / 4) * 0.22) +
    (analysis.uniqueRatio * 0.08),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "long-term-memory",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `persistenceCues=${persistenceCues}; profileCues=${profileCues}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      persistenceCues,
      profileCues,
      tokenCount: analysis.tokenCount,
      hasText: Boolean(analysis.text),
    },
  };
}
