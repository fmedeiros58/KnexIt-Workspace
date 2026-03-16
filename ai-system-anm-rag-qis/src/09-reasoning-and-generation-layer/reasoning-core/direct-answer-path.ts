import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildDirectAnswerPath(state: ProcessingState): string {
  return `Caminho direto: responder com foco em '${state.collapsedTruth.summary || state.normalizedMessage}'.`;
}
