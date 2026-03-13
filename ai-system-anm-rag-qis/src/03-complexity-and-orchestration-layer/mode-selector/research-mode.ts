export interface ResearchModeInput {
  text: string;
  intent: string;
}

export interface ResearchModeOutput {
  mode: "research";
  score: number;
  rationale: string;
  ok: boolean;
  component: string;
  detail: string;
  context: Record<string, unknown>;
}

export function researchMode(input: ResearchModeInput): ResearchModeOutput {
  const researchHits = (input.text.match(/\b(fontes|source|citation|cite|latest|atual|pesquise|research|verify|verifique)\b/gi) || []).length;
  const intentBoost = input.intent === "research" ? 0.24 : 0;
  const score = Math.max(0.05, Math.min(0.99, 0.2 + (researchHits * 0.14) + intentBoost));

  return {
    mode: "research",
    score: Number(score.toFixed(4)),
    rationale: researchHits > 0 ? "research_markers" : "low_signal",
    ok: true,
    component: "research-mode",
    detail: "research",
    context: {
      researchHits,
      intent: input.intent,
    },
  };
}
