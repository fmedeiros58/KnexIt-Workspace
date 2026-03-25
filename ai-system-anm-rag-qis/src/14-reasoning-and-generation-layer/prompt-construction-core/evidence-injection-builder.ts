import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildEvidenceInjection(state: ProcessingState): string {
  if (!state.retrievedEvidence.length) return "Evidencias: (nao disponiveis)";
  return `Evidencias: ${state.retrievedEvidence.slice(0, 6).join(" || ")}`;
}
