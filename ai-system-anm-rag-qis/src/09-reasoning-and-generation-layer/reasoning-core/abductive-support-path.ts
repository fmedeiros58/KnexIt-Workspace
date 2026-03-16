import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildAbductiveSupportPath(state: ProcessingState): string {
  const evidence = state.retrievedEvidence[0] || "sem evidencia dominante";
  return `Suporte abdutivo: hipotese principal explicada por evidencia-chave '${evidence}'.`;
}
