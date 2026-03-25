import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildHypothesisInjection(state: ProcessingState): string {
  if (!state.hypothesisSet.length) return "Hipoteses: (nao geradas)";
  return `Hipoteses: ${state.hypothesisSet.slice(0, 3).map((item) => `${item.id}=${item.claim}`).join(" | ")}`;
}
