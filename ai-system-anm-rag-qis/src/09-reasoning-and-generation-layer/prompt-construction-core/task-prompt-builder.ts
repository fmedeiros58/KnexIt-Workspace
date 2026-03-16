import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildTaskPrompt(state: ProcessingState): string {
  return `Tarefa: responder ao usuario com base em '${state.normalizedMessage}', mantendo coerencia, rastreabilidade e rigor.`;
}
