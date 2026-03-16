export interface ContextualTensionReviewInput {
  activeContext: string[];
  activeConstraints: string[];
}

export interface ContextualTensionReviewOutput {
  tensions: string[];
  tensionScore: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function contextualTensionReview(input: ContextualTensionReviewInput): ContextualTensionReviewOutput {
  const tensions: string[] = [];
  const hasBrief = input.activeConstraints.includes("prefer_brief_tone");
  const hasDeep = input.activeConstraints.includes("prefer_deep_dive");
  const hasCodeOnly = input.activeConstraints.includes("prefer_code_only");
  const hasCitations = input.activeConstraints.includes("require_citations");

  if (hasBrief && hasDeep) tensions.push("Conflito entre concisao e aprofundamento no mesmo turno.");
  if (hasCodeOnly && hasCitations) tensions.push("Pedido de codigo puro em tensao com exigencia de citacoes textuais.");
  if (input.activeContext.length === 0) tensions.push("Contexto ativo vazio para reconciliar restricoes.");

  const tensionScore = Math.max(0, Math.min(1, (tensions.length * 0.3)));

  return {
    tensions,
    tensionScore: Number(tensionScore.toFixed(4)),
    ok: true,
    component: "contextual-tension-review",
    score: Number(tensionScore.toFixed(4)),
    detail: tensions.join(" ") || "sem tensoes contextuais dominantes",
    context: {
      contextSize: input.activeContext.length,
      constraintSize: input.activeConstraints.length,
    },
  };
}
