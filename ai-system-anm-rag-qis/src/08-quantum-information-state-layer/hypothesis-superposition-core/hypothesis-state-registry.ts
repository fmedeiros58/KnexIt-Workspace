import type { QuantumHypothesis } from "../quantum-core-types";

export interface HypothesisStateRegistryInput {
  branches: string[];
  sourceUrls: string[];
}

export interface HypothesisStateRegistryOutput {
  hypotheses: QuantumHypothesis[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function hypothesisStateRegistry(input: HypothesisStateRegistryInput): HypothesisStateRegistryOutput {
  const support = input.sourceUrls.slice(0, 4);
  const hypotheses: QuantumHypothesis[] = input.branches.map((claim, index) => ({
    id: `q-branch-${index + 1}`,
    claim,
    weight: Number((1 / Math.max(1, input.branches.length)).toFixed(6)),
    supportingSources: support,
    contradictorySources: [],
    coherence: Number((0.68 - (index * 0.06)).toFixed(4)),
    evidenceSupport: Number((0.62 - (index * 0.05)).toFixed(4)),
    memorySupport: Number((0.5 - (index * 0.04)).toFixed(4)),
    contextSupport: Number((0.58 - (index * 0.05)).toFixed(4)),
  }));

  return {
    hypotheses,
    ok: true,
    component: "hypothesis-state-registry",
    score: Number(Math.min(1, hypotheses.length / 4).toFixed(4)),
    detail: `hypotheses=${hypotheses.length}`,
    context: {
      sourceCount: support.length,
    },
  };
}
