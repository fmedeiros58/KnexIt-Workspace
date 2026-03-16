import type { ProcessingState } from "../bridges/contracts/processing-state";

export function applyLatencyBudget(state: ProcessingState) {
  state.timings.latencyBudgetMs = state.executionPlan.selectedRoute === "quantum-state" ? 12000 : 6000;
  return state;
}
