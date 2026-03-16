export interface InternalConsistencyReviewInput {
  collapsedSummary: string;
  caveats: string[];
  implications: string[];
}

export interface InternalConsistencyReviewOutput {
  consistencyIssues: string[];
  consistencyScore: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function internalConsistencyReview(input: InternalConsistencyReviewInput): InternalConsistencyReviewOutput {
  const issues: string[] = [];
  const summary = input.collapsedSummary.toLowerCase();

  if (!summary.trim()) issues.push("Resumo colapsado vazio para avaliacao de consistencia.");
  if (summary.includes("certeza") && input.caveats.length > 0) {
    issues.push("Resumo sugere certeza alta apesar de caveats ativos.");
  }
  if (input.implications.length === 0) {
    issues.push("Ausencia de implicacoes reduz verificabilidade interna do raciocinio.");
  }

  const consistencyScore = Math.max(0, Math.min(1, 1 - (issues.length * 0.24)));

  return {
    consistencyIssues: issues,
    consistencyScore: Number(consistencyScore.toFixed(4)),
    ok: true,
    component: "internal-consistency-review",
    score: Number(consistencyScore.toFixed(4)),
    detail: issues.join(" ") || "consistente",
    context: {
      caveatCount: input.caveats.length,
      implicationCount: input.implications.length,
    },
  };
}
