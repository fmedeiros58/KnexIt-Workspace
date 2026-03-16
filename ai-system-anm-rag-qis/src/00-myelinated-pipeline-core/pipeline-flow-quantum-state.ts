/**
 * Responsabilidade do arquivo:
 * - Encapsular execucao da rota quantum-state.
 * - Registrar selectedRoute antes de delegar ao descending flow.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { runDescendingFlow } from "./pipeline-flow-descending";

export async function runQuantumStateFlow(state: ProcessingState) {
  state.executionPlan.selectedRoute = "quantum-state";
  return runDescendingFlow(state, "quantum-state");
}
