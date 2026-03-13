import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface PlasticityEngineInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface PlasticityEngineOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function plasticityEngine(input: PlasticityEngineInput = {}): PlasticityEngineOutput {
  const analysis = analyzeMemoryText(input.text);
  const learningCues = countMemoryMatches(
    analysis.normalized,
    /\b(aprender|learning|learn|feedback|ajuste|adapt|evoluir|improve)\b/g,
  );
  const freezeCues = countMemoryMatches(
    analysis.normalized,
    /\b(fixo|imutavel|nao mudar|frozen|do not change)\b/g,
  );

  const inferredScore = clamp01(
    0.28 +
    (Math.min(1, learningCues / 5) * 0.44) -
    (Math.min(1, freezeCues / 3) * 0.18) +
    (analysis.uniqueRatio * 0.1),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "plasticity-engine",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `learningCues=${learningCues}; freezeCues=${freezeCues}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      learningCues,
      freezeCues,
      hasText: Boolean(analysis.text),
    },
  };
}
