import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildMultiHypothesisReasoning(state: ProcessingState): string {
  const hypotheses = state.hypothesisSet.slice(0, 3).map((item) => `${item.id}:${item.weight.toFixed(2)}`);
  return hypotheses.length
    ? `Raciocinio multihipotese: ${hypotheses.join(" | ")}`
    : "Raciocinio multihipotese: nao disponivel";
}
