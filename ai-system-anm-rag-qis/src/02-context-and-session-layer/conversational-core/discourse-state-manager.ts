import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface DiscourseStateManagerInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface DiscourseStateManagerOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function pickDiscourseState(questionCount: number, commandHits: number, analysisHits: number) {
  if (questionCount >= 2) return "inquiry-heavy";
  if (commandHits >= 2) return "directive";
  if (analysisHits >= 2) return "analytical";
  if (questionCount > 0 && commandHits > 0) return "mixed";
  return "neutral";
}

export function discourseStateManager(input: DiscourseStateManagerInput = {}): DiscourseStateManagerOutput {
  const analysis = analyzeSignalText(input.text);
  const commandHits = countSignalMatches(
    analysis.normalized,
    /\b(faca|gere|crie|execute|mostre|build|generate|create|show)\b/g,
  );
  const analysisHits = countSignalMatches(
    analysis.normalized,
    /\b(analise|inferencia|implicacao|coerencia|evaluate|infer|implication)\b/g,
  );
  const discourseState = pickDiscourseState(analysis.questionCount, commandHits, analysisHits);

  const inferredScore = clamp01(
    0.24 +
    (Math.min(1, (analysis.questionCount + commandHits + analysisHits) / 6) * 0.54) +
    (analysis.uniqueRatio * 0.12),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "discourse-state-manager",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `state=${discourseState}; questions=${analysis.questionCount}; commands=${commandHits}; analysis=${analysisHits}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      discourseState,
      questionCount: analysis.questionCount,
      commandHits,
      analysisHits,
      hasText: Boolean(analysis.text),
    },
  };
}
