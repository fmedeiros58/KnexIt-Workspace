import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface GeneralResonanceEngineInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface GeneralResonanceEngineOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function generalResonanceEngine(input: GeneralResonanceEngineInput = {}): GeneralResonanceEngineOutput {
  const analysis = analyzeMemoryText(input.text);
  const semanticLinks = countMemoryMatches(
    analysis.normalized,
    /\b(portanto|porque|logo|entao|therefore|because|so|thus)\b/g,
  );
  const consistencyFlags = countMemoryMatches(
    analysis.normalized,
    /\b(consistente|coerente|resonancia|match|consistent|coherent)\b/g,
  );
  const contradictionFlags = countMemoryMatches(
    analysis.normalized,
    /\b(contradicao|conflito|inconsistente|contradiction|conflict)\b/g,
  );

  const inferredScore = clamp01(
    0.3 +
    (Math.min(1, semanticLinks / 5) * 0.24) +
    (Math.min(1, consistencyFlags / 4) * 0.28) -
    (Math.min(1, contradictionFlags / 3) * 0.2),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "general-resonance-engine",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `semanticLinks=${semanticLinks}; consistency=${consistencyFlags}; contradiction=${contradictionFlags}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      semanticLinks,
      consistencyFlags,
      contradictionFlags,
      hasText: Boolean(analysis.text),
    },
  };
}
