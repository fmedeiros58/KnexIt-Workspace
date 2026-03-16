export interface QueryLengthScorerInput {
  text: string;
}

export interface QueryLengthScorerOutput {
  tokenCount: number;
  score: number;
  ok: boolean;
  component: string;
  detail: string;
  context: Record<string, unknown>;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function queryLengthScorer(input: QueryLengthScorerInput): QueryLengthScorerOutput {
  const tokenCount = input.text.split(/\s+/).filter(Boolean).length;
  const score = clamp01(tokenCount / 48);

  return {
    tokenCount,
    score: Number(score.toFixed(4)),
    ok: true,
    component: "query-length-scorer",
    detail: `tokens=${tokenCount}`,
    context: {
      tokenCount,
    },
  };
}
