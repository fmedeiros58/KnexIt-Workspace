export interface AnalysisModeInput {
  text: string;
  complexityScore: number;
  ambiguityScore: number;
  intent: string;
}

export interface AnalysisModeOutput {
  mode: "analysis";
  score: number;
  rationale: string;
  ok: boolean;
  component: string;
  detail: string;
  context: Record<string, unknown>;
}

function normalize(value: string) {
  return `${value || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function analysisMode(input: AnalysisModeInput): AnalysisModeOutput {
  const normalized = normalize(input.text);
  const analysisHits = (normalized.match(/\b(analise|analyze|compare|tradeoff|causa|impacto|implicacoes|why)\b/gi) || []).length;
  const intentBoost = input.intent === "analysis" ? 0.22 : 0;
  const score = Math.max(
    0.05,
    Math.min(0.99, 0.18 + (analysisHits * 0.13) + (input.complexityScore * 0.28) + (input.ambiguityScore * 0.18) + intentBoost),
  );

  return {
    mode: "analysis",
    score: Number(score.toFixed(4)),
    rationale: analysisHits > 0 ? "analysis_markers" : "complexity_driven",
    ok: true,
    component: "analysis-mode",
    detail: "analysis",
    context: {
      analysisHits,
      complexityScore: input.complexityScore,
      ambiguityScore: input.ambiguityScore,
    },
  };
}
