import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildInferenceInjection(state: ProcessingState): string {
  const implications = state.inferentialMap.implications.slice(0, 4).join(" | ");
  const scenarios = state.inferentialMap.scenarios.slice(0, 3).join(" | ");
  return `Inferencias: ${implications || "(vazio)"}; Cenarios: ${scenarios || "(vazio)"}`;
}
