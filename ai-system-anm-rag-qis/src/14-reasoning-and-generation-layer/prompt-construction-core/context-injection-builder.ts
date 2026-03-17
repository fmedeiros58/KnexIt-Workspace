import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildContextInjection(state: ProcessingState): string {
  const context = state.activeContext.slice(-4).join(" | ");
  return context ? `Contexto ativo: ${context}` : "Contexto ativo: (vazio)";
}
