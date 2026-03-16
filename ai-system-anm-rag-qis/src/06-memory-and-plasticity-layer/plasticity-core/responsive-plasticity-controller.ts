import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface ResponsivePlasticityControllerInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ResponsivePlasticityControllerOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function responsivePlasticityController(
  input: ResponsivePlasticityControllerInput = {},
): ResponsivePlasticityControllerOutput {
  const analysis = analyzeMemoryText(input.text);
  const responsivenessCues = countMemoryMatches(
    analysis.normalized,
    /\b(responsivo|imediato|agora|adaptar|quickly|responsive|instant)\b/g,
  );
  const throttlingCues = countMemoryMatches(
    analysis.normalized,
    /\b(devagar|gradual|cautela|slow|careful|throttle)\b/g,
  );

  const inferredScore = clamp01(
    0.26 +
    (Math.min(1, responsivenessCues / 4) * 0.42) -
    (Math.min(1, throttlingCues / 4) * 0.12) +
    (Math.min(1, analysis.punctuationCount / 8) * 0.1),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "responsive-plasticity-controller",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `responsiveness=${responsivenessCues}; throttling=${throttlingCues}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      responsivenessCues,
      throttlingCues,
      hasText: Boolean(analysis.text),
    },
  };
}
