/**
 * Responsabilidade do arquivo:
 * - Encapsular execucao da rota reflective.
 * - Registrar selectedRoute antes de delegar ao descending flow.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { runDescendingFlow } from "./pipeline-flow-descending";

export async function runReflectiveFlow(state: ProcessingState) {
  state.executionPlan.selectedRoute = "reflective";
  return runDescendingFlow(state, "reflective");
}
