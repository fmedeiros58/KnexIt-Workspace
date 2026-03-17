/**
 * Responsabilidade do arquivo:
 * - Encapsular execucao da rota minima.
 * - Registrar selectedRoute antes de delegar ao descending flow.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { runDescendingFlow } from "./pipeline-flow-descending";

export async function runMinimumFlow(state: ProcessingState) {
  state.executionPlan.selectedRoute = "minimum";
  return runDescendingFlow(state, "minimum");
}
