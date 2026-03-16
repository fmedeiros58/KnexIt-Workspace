import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface ConversationalIntentionResolverInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ConversationalIntentionResolverOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function resolveIntent(normalized: string) {
  const intents = [
    { name: "explain", hits: countSignalMatches(normalized, /\b(explique|explain|entenda|understand)\b/g) },
    { name: "compare", hits: countSignalMatches(normalized, /\b(compare|comparar|diferenca|versus|vs)\b/g) },
    { name: "plan", hits: countSignalMatches(normalized, /\b(plano|plan|roadmap|passo a passo|step by step)\b/g) },
    { name: "verify", hits: countSignalMatches(normalized, /\b(verifique|check|validar|confirmar|proof)\b/g) },
    { name: "create", hits: countSignalMatches(normalized, /\b(crie|gere|build|create|draft)\b/g) },
  ];
  intents.sort((a, b) => b.hits - a.hits);
  return intents[0]?.hits ? intents[0] : { name: "chat", hits: 0 };
}

export function conversationalIntentionResolver(
  input: ConversationalIntentionResolverInput = {},
): ConversationalIntentionResolverOutput {
  const analysis = analyzeSignalText(input.text);
  const intent = resolveIntent(analysis.normalized);

  const inferredScore = clamp01(
    0.26 +
    (Math.min(1, intent.hits / 3) * 0.46) +
    (Math.min(1, analysis.questionCount / 2) * 0.16) +
    (analysis.uniqueRatio * 0.12),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "conversational-intention-resolver",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `intent=${intent.name}; hits=${intent.hits}; questions=${analysis.questionCount}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      resolvedIntent: intent.name,
      intentHits: intent.hits,
      questionCount: analysis.questionCount,
      hasText: Boolean(analysis.text),
    },
  };
}
