export interface SemanticComplexityScorerInput {
  text: string;
}

export interface SemanticComplexityScorerOutput {
  score: number;
  markers: string[];
  ok: boolean;
  component: string;
  detail: string;
  context: Record<string, unknown>;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function semanticComplexityScorer(input: SemanticComplexityScorerInput): SemanticComplexityScorerOutput {
  const text = input.text || "";
  const markers: string[] = [];

  const connectiveCount = (text.match(/\b(porque|portanto|contudo|entretanto|however|therefore|although|since|if|then)\b/gi) || []).length;
  const comparisonCount = (text.match(/\b(compare|comparar|tradeoff|pr[oó]s|contras|versus|vs)\b/gi) || []).length;
  const constraintCount = (text.match(/\b(sem|without|com|with|limite|constraint|precisa|must)\b/gi) || []).length;
  const nestedPunctuation = (text.match(/[;:()]/g) || []).length;

  if (connectiveCount > 0) markers.push("connectives");
  if (comparisonCount > 0) markers.push("comparisons");
  if (constraintCount > 0) markers.push("constraints");
  if (nestedPunctuation > 0) markers.push("nested_punctuation");

  const score = clamp01(
    (connectiveCount * 0.12) +
    (comparisonCount * 0.18) +
    (constraintCount * 0.08) +
    (nestedPunctuation * 0.05),
  );

  return {
    score: Number(score.toFixed(4)),
    markers,
    ok: true,
    component: "semantic-complexity-scorer",
    detail: `markers=${markers.join(",") || "none"}`,
    context: {
      connectiveCount,
      comparisonCount,
      constraintCount,
      nestedPunctuation,
    },
  };
}
