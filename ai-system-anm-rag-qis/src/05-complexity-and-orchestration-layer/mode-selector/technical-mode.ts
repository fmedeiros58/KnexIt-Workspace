export interface TechnicalModeInput {
  text: string;
  complexityScore: number;
  intent: string;
}

export interface TechnicalModeOutput {
  mode: "technical";
  score: number;
  rationale: string;
  ok: boolean;
  component: string;
  detail: string;
  context: Record<string, unknown>;
}

export function technicalMode(input: TechnicalModeInput): TechnicalModeOutput {
  const keywordHits = (input.text.match(/\b(api|endpoint|typescript|javascript|python|sql|docker|kubernetes|stack trace|bug|debug)\b/gi) || []).length;
  const intentBoost = input.intent === "technical" ? 0.2 : 0;
  const score = Math.max(0.05, Math.min(0.99, 0.2 + (keywordHits * 0.12) + (input.complexityScore * 0.25) + intentBoost));

  return {
    mode: "technical",
    score: Number(score.toFixed(4)),
    rationale: keywordHits > 0 ? "technical_keywords" : "low_signal",
    ok: true,
    component: "technical-mode",
    detail: "technical",
    context: {
      keywordHits,
      intent: input.intent,
    },
  };
}
