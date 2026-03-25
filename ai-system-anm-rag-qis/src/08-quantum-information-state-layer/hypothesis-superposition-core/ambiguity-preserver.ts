export interface AmbiguityPreserverInput {
  branches: string[];
  ambiguity: number;
}

export interface AmbiguityPreserverOutput {
  preserved: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function ambiguityPreserver(input: AmbiguityPreserverInput): AmbiguityPreserverOutput {
  const ambiguity = Math.max(0, Math.min(1, input.ambiguity));
  const keepCount = ambiguity >= 0.55 ? 4 : ambiguity >= 0.32 ? 3 : 2;
  const preserved = input.branches.slice(0, keepCount);

  return {
    preserved,
    ok: true,
    component: "ambiguity-preserver",
    score: Number(ambiguity.toFixed(4)),
    detail: `kept=${preserved.length}`,
    context: {
      ambiguity,
      original: input.branches.length,
    },
  };
}
