/**
 * Responsabilidade do arquivo:
 * - Encapsular execucao da rota inferential.
 * - Registrar selectedRoute antes de delegar ao descending flow.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { runDescendingFlow } from "./pipeline-flow-descending";

export async function runInferentialFlow(state: ProcessingState) {
  state.executionPlan.selectedRoute = "inferential";
  return runDescendingFlow(state, "inferential");
}
