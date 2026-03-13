export interface ActiveConstraintsInput {
  existing: string[];
  safetyFlags: string[];
  instructionFlags: string[];
}

export interface ActiveConstraintsOutput {
  constraints: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function activeConstraints(input: ActiveConstraintsInput): ActiveConstraintsOutput {
  const normalized = [...new Set([...input.existing, ...input.instructionFlags, ...input.safetyFlags])]
    .filter(Boolean)
    .slice(-16);
  const score = Math.max(0.2, Math.min(1, 0.25 + (normalized.length * 0.05)));

  return {
    constraints: normalized,
    ok: true,
    component: "active-constraints",
    score: Number(score.toFixed(4)),
    detail: `constraints=${normalized.length}`,
    context: {
      safety: input.safetyFlags.length,
      instructions: input.instructionFlags.length,
    },
  };
}
