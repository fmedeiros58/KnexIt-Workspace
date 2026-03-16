export interface ReflectiveHandoffInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ReflectiveHandoffOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function countMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) || []).length;
}

export function reflectiveHandoff(input: ReflectiveHandoffInput = {}): ReflectiveHandoffOutput {
  const text = (input.text || "").trim();
  const normalized = text.toLowerCase();

  const assumptionHits = countMatches(normalized, /\b(assumption|pressuposto|assume|supoe|premissa)\b/g);
  const caveatHits = countMatches(normalized, /\b(caveat|limite|limitacao|restricao|boundary)\b/g);
  const tensionHits = countMatches(normalized, /\b(tensao|tradeoff|risco|risk|conflict|conflito)\b/g);
  const overclaimHits = countMatches(normalized, /\b(certeza absoluta|sempre|nunca|obvio|certain|always|never)\b/g);

  const inferredScore = clamp01(
    0.28 +
    (Math.min(1, (assumptionHits + caveatHits) / 6) * 0.4) +
    (Math.min(1, tensionHits / 4) * 0.22) -
    (Math.min(1, overclaimHits / 3) * 0.12),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;
  const cautionLevel = finalScore >= 0.72 ? "high" : finalScore >= 0.46 ? "medium" : "low";

  return {
    ok: true,
    component: "reflective-handoff",
    score: Number(finalScore.toFixed(4)),
    detail: text
      ? `assumptions=${assumptionHits}; caveats=${caveatHits}; tensions=${tensionHits}; caution=${cautionLevel}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      assumptionHits,
      caveatHits,
      tensionHits,
      overclaimHits,
      cautionLevel,
      hasText: Boolean(text),
    },
  };
}
