export interface InferentialHandoffInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface InferentialHandoffOutput {
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

export function inferentialHandoff(input: InferentialHandoffInput = {}): InferentialHandoffOutput {
  const text = (input.text || "").trim();
  const normalized = text.toLowerCase();

  const implicationHits = countMatches(normalized, /\b(implica|implication|logo|therefore|decorre|resulta)\b/g);
  const scenarioHits = countMatches(normalized, /\b(cenario|scenario|se isso|if this|se ocorrer)\b/g);
  const secondOrderHits = countMatches(normalized, /\b(segundo ordem|second order|efeito indireto|downstream)\b/g);
  const practicalityHits = countMatches(normalized, /\b(pratico|impacto|impact|operacional|execution)\b/g);

  const inferredScore = clamp01(
    0.26 +
    (Math.min(1, implicationHits / 5) * 0.32) +
    (Math.min(1, scenarioHits / 4) * 0.26) +
    (Math.min(1, secondOrderHits / 3) * 0.1) +
    (Math.min(1, practicalityHits / 4) * 0.14),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;
  const inferentialDepth = finalScore >= 0.74 ? "deep" : finalScore >= 0.48 ? "medium" : "shallow";

  return {
    ok: true,
    component: "inferential-handoff",
    score: Number(finalScore.toFixed(4)),
    detail: text
      ? `implications=${implicationHits}; scenarios=${scenarioHits}; secondOrder=${secondOrderHits}; depth=${inferentialDepth}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      implicationHits,
      scenarioHits,
      secondOrderHits,
      practicalityHits,
      inferentialDepth,
      hasText: Boolean(text),
    },
  };
}
