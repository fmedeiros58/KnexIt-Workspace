/**
 * Responsabilidade do arquivo:
 * - Avaliar gates de execucao por tempo decorrido e politica da rota.
 * - Reusar cutoffs por camada pesada para decisões do fluxo descendente.
 * - Expor resolvedor de politica para outros módulos de governança.
 */
import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { LATENCY_POLICY_BY_ROUTE } from "./pipeline-latency-policy";

function elapsedMs(state: ProcessingState) {
  const startedAt = state.timings.pipelineStartedAt || Date.now();
  return Math.max(0, Date.now() - startedAt);
}

export function resolveLatencyPolicy(route: PipelineRoute) {
  return LATENCY_POLICY_BY_ROUTE[route];
}

export function shouldRunKnowledgeByLatency(state: ProcessingState, route: PipelineRoute) {
  const policy = resolveLatencyPolicy(route);
  return elapsedMs(state) <= policy.knowledgeCutoffMs;
}

export function shouldRunReflectiveByLatency(state: ProcessingState, route: PipelineRoute) {
  const policy = resolveLatencyPolicy(route);
  return elapsedMs(state) <= policy.reflectiveCutoffMs;
}

export function shouldRunInferentialByLatency(state: ProcessingState, route: PipelineRoute) {
  const policy = resolveLatencyPolicy(route);
  return elapsedMs(state) <= policy.inferentialCutoffMs;
}

export function shouldRunQuantumByLatency(state: ProcessingState, route: PipelineRoute) {
  const policy = resolveLatencyPolicy(route);
  return elapsedMs(state) <= policy.quantumCutoffMs;
}

export function shouldRunAcademicByLatency(state: ProcessingState, route: PipelineRoute) {
  const policy = resolveLatencyPolicy(route);
  return elapsedMs(state) <= policy.academicCutoffMs;
}
