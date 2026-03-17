import type { QuantumHypothesis } from "../quantum-core-types";

export interface MultiHypothesisSynthesisInput {
  ordered: QuantumHypothesis[];
  maxItems?: number;
}

export interface MultiHypothesisSynthesisOutput {
  synthesisSummary: string;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function multiHypothesisSynthesis(input: MultiHypothesisSynthesisInput): MultiHypothesisSynthesisOutput {
  const maxItems = Math.max(2, Math.min(5, input.maxItems ?? 3));
  const snippets = input.ordered
    .slice(0, maxItems)
    .map((item) => `${item.id}:${item.claim}`);
  const synthesisSummary = snippets.length
    ? `Sintese multi-hipotese => ${snippets.join(" || ")}`
    : "Sintese multi-hipotese indisponivel.";

  return {
    synthesisSummary,
    ok: true,
    component: "multi-hypothesis-synthesis",
    score: Number(Math.min(1, snippets.length / maxItems).toFixed(4)),
    detail: synthesisSummary,
    context: {
      maxItems,
      used: snippets.length,
    },
  };
}
