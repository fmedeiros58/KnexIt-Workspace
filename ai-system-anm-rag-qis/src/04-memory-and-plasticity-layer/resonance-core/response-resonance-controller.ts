import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface ResponseResonanceControllerInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ResponseResonanceControllerOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function responseResonanceController(
  input: ResponseResonanceControllerInput = {},
): ResponseResonanceControllerOutput {
  const analysis = analyzeMemoryText(input.text);
  const answerabilityCues = countMemoryMatches(
    analysis.normalized,
    /\b(responda|response|resposta|solucao|solution|answer|deliver)\b/g,
  );
  const uncertaintyCues = countMemoryMatches(
    analysis.normalized,
    /\b(talvez|incerto|nao sei|uncertain|unknown|maybe)\b/g,
  );

  const inferredScore = clamp01(
    0.26 +
    (Math.min(1, answerabilityCues / 4) * 0.42) +
    (Math.min(1, analysis.punctuationCount / 8) * 0.1) -
    (Math.min(1, uncertaintyCues / 3) * 0.18),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "response-resonance-controller",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `answerability=${answerabilityCues}; uncertainty=${uncertaintyCues}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      answerabilityCues,
      uncertaintyCues,
      hasText: Boolean(analysis.text),
    },
  };
}
