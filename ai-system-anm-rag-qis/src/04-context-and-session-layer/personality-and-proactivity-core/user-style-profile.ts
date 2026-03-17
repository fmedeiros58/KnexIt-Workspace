import { analyzeText, clamp01, countMatches } from "./personality-utils";

export interface UserStyleProfileInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface UserStyleProfileOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function averageTokenLength(tokens: string[]) {
  if (!tokens.length) return 0;
  return tokens.reduce((sum, token) => sum + token.length, 0) / tokens.length;
}

function pickStyleTag(commandHits: number, analyticalHits: number, conversationalHits: number, questionCount: number) {
  if (commandHits >= 2) return "directive";
  if (analyticalHits >= 2) return "analytical";
  if (questionCount >= 2) return "inquisitive";
  if (conversationalHits >= 1) return "conversational";
  return "neutral";
}

export function userStyleProfile(input: UserStyleProfileInput = {}): UserStyleProfileOutput {
  const analysis = analyzeText(input.text);
  const commandHits = countMatches(
    analysis.normalized,
    /\b(faca|gere|crie|mostre|continue|implemente|execute|do|build|create)\b/g,
  );
  const analyticalHits = countMatches(
    analysis.normalized,
    /\b(compare|analise|analisa|tradeoff|hipotese|evidencia|inferencia|coerencia)\b/g,
  );
  const conversationalHits = countMatches(
    analysis.normalized,
    /\b(oi|ola|obrigado|valeu|vamos|ajuda)\b/g,
  );
  const tag = pickStyleTag(commandHits, analyticalHits, conversationalHits, analysis.questionCount);
  const avgTokenLength = averageTokenLength(analysis.tokens);

  const inferredScore = clamp01(
    0.3 +
    (Math.min(1, analysis.uniqueRatio) * 0.22) +
    (Math.min(1, avgTokenLength / 7) * 0.18) +
    (Math.min(1, (commandHits + analyticalHits + conversationalHits) / 6) * 0.22) +
    (Math.min(1, analysis.questionCount / 3) * 0.08),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "user-style-profile",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `style=${tag}; command=${commandHits}; analytical=${analyticalHits}; questions=${analysis.questionCount}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      styleTag: tag,
      commandHits,
      analyticalHits,
      conversationalHits,
      avgTokenLength: Number(avgTokenLength.toFixed(3)),
      uniqueRatio: Number(analysis.uniqueRatio.toFixed(4)),
      hasText: Boolean(analysis.text),
    },
  };
}
