import type { QuantumHypothesis } from "../quantum-core-types";

export interface HypothesisFusionEngineInput {
  ordered: QuantumHypothesis[];
}

export interface HypothesisFusionEngineOutput {
  fusedSummary: string;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function hypothesisFusionEngine(input: HypothesisFusionEngineInput): HypothesisFusionEngineOutput {
  const top = input.ordered.slice(0, 2);
  const fusedSummary = top.length
    ? top.map((item) => item.claim).join(" | ")
    : "Sem fusao disponivel.";

  return {
    fusedSummary,
    ok: true,
    component: "hypothesis-fusion-engine",
    score: Number(Math.min(1, top.length / 2).toFixed(4)),
    detail: fusedSummary,
    context: {
      topCount: top.length,
    },
  };
}
