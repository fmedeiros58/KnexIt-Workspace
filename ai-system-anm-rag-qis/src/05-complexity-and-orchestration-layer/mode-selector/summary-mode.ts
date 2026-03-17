export interface SummaryModeInput {
  text: string;
  intent: string;
}

export interface SummaryModeOutput {
  mode: "summary";
  score: number;
  rationale: string;
  ok: boolean;
  component: string;
  detail: string;
  context: Record<string, unknown>;
}

export function summaryMode(input: SummaryModeInput): SummaryModeOutput {
  const hits = (input.text.match(/\b(resuma|resumir|sumarize|summarize|tl;dr|em poucas linhas|resumo)\b/gi) || []).length;
  const intentBoost = input.intent === "summary" ? 0.28 : 0;
  const score = Math.max(0.05, Math.min(0.99, 0.16 + (hits * 0.2) + intentBoost));

  return {
    mode: "summary",
    score: Number(score.toFixed(4)),
    rationale: hits > 0 ? "summary_markers" : "low_signal",
    ok: true,
    component: "summary-mode",
    detail: "summary",
    context: {
      hits,
      intent: input.intent,
    },
  };
}
