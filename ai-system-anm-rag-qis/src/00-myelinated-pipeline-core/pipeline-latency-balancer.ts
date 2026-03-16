/**
 * Responsabilidade do arquivo:
 * - Aplicar budget de latencia conforme politica da rota selecionada.
 * - Salvar pipelineBudgetMs no estado para gates posteriores.
 * - Garantir timeout de orchestration nunca acima do budget da rota.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { resolveLatencyPolicy } from "./pipeline-latency-gates";

export function applyLatencyBudget(state: ProcessingState) {
  const route = state.executionPlan.selectedRoute;
  const policy = resolveLatencyPolicy(route);

  state.timings.pipelineBudgetMs = policy.maxBudgetMs;
  state.timings.latencyBudgetMs = policy.maxBudgetMs;

  const orchestrationTimeout = state.timings.orchestrationTimeoutMs
    ?? state.executionPlan.timeoutMs
    ?? policy.maxBudgetMs;

  state.timings.orchestrationTimeoutMs = Math.min(orchestrationTimeout, policy.maxBudgetMs);
  if (typeof state.executionPlan.timeoutMs === "number") {
    state.executionPlan.timeoutMs = Math.min(state.executionPlan.timeoutMs, policy.maxBudgetMs);
  }

  return state;
}
