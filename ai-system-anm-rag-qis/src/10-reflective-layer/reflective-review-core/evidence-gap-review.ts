export interface EvidenceGapReviewInput {
  evidenceCount: number;
  sourceCount: number;
  claimCount: number;
}

export interface EvidenceGapReviewOutput {
  gaps: string[];
  gapScore: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function evidenceGapReview(input: EvidenceGapReviewInput): EvidenceGapReviewOutput {
  const gaps: string[] = [];
  if (input.sourceCount === 0) gaps.push("Ausencia de fontes externas para sustentacao direta.");
  if (input.evidenceCount < 2) gaps.push("Baixo volume de evidencias para confirmar a hipotese dominante.");
  if (input.claimCount > 2 && input.evidenceCount < input.claimCount) {
    gaps.push("Quantidade de afirmacoes excede cobertura evidencial observada.");
  }

  const gapScore = Math.max(0, Math.min(1, (gaps.length * 0.28) + (input.sourceCount === 0 ? 0.24 : 0)));

  return {
    gaps,
    gapScore: Number(gapScore.toFixed(4)),
    ok: true,
    component: "evidence-gap-review",
    score: Number(gapScore.toFixed(4)),
    detail: gaps.join(" ") || "sem lacunas criticas",
    context: {
      evidenceCount: input.evidenceCount,
      sourceCount: input.sourceCount,
      claimCount: input.claimCount,
    },
  };
}
