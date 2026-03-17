import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface SemanticResonanceMapperInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface SemanticResonanceMapperOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function semanticResonanceMapper(
  input: SemanticResonanceMapperInput = {},
): SemanticResonanceMapperOutput {
  const analysis = analyzeMemoryText(input.text);
  const semanticCues = countMemoryMatches(
    analysis.normalized,
    /\b(conceito|semantic|meaning|definition|relation|implication|context)\b/g,
  );
  const bridgeCues = countMemoryMatches(
    analysis.normalized,
    /\b(conecta|liga|bridge|map|alinha|align)\b/g,
  );

  const inferredScore = clamp01(
    0.24 +
    (Math.min(1, semanticCues / 5) * 0.36) +
    (Math.min(1, bridgeCues / 4) * 0.24) +
    (analysis.uniqueRatio * 0.12),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "semantic-resonance-mapper",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `semanticCues=${semanticCues}; bridgeCues=${bridgeCues}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      semanticCues,
      bridgeCues,
      uniqueRatio: Number(analysis.uniqueRatio.toFixed(4)),
      hasText: Boolean(analysis.text),
    },
  };
}
