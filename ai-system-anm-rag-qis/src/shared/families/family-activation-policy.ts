/**
 * Responsabilidade do arquivo:
 * - Definir politica de ativacao de familias por rota/steps/latencia/safety.
 * - Fornecer gate padronizado para runtime resolver de familias ativas.
 * - Preservar pipeline descendente usando familias apenas como camada de governanca.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import type { FamilyDefinition } from "./family-types";

function routeAllowed(state: ProcessingState, family: FamilyDefinition) {
  if (!family.preferredRoute?.length) return true;
  return family.preferredRoute.includes(state.executionPlan.selectedRoute);
}

function stepsAllowed(state: ProcessingState, family: FamilyDefinition) {
  if (!family.preferredSteps?.length) return true;
  const planned = state.executionPlan.steps || [];
  return family.preferredSteps.some((step) => planned.includes(step));
}

function safetyAllowsDeep(state: ProcessingState) {
  const constraints = state.activeConstraints || [];
  return !constraints.some((item) =>
    /safety_block_mode|refuse_high_risk_request|fallback:safe_refusal_mode|error_category:safety/i.test(item),
  );
}

function latencyAllows(state: ProcessingState, family: FamilyDefinition) {
  const budget = state.timings?.pipelineBudgetMs || Infinity;
  const elapsed = state.timings?.pipelineStartedAt
    ? Math.max(0, Date.now() - state.timings.pipelineStartedAt)
    : 0;

  if (family.cost === "minimal") return true;
  if (family.cost === "low") return elapsed <= budget;
  if (family.cost === "medium") return elapsed <= budget * 0.85;
  if (family.cost === "high") return elapsed <= budget * 0.70;
  return elapsed <= budget * 0.55;
}

function routeCostAllows(state: ProcessingState, family: FamilyDefinition) {
  const route = state.executionPlan.selectedRoute;
  if (route === "minimum") return family.cost === "minimal" || family.cost === "low";
  if (route === "reflective") return family.cost !== "very-high";
  return true;
}

export function isFamilyActive(state: ProcessingState, family: FamilyDefinition) {
  if (!routeCostAllows(state, family)) return false;

  if (family.activationMode === "always-light") return true;

  if (family.activationMode === "safety-gated") {
    return safetyAllowsDeep(state);
  }

  if (family.activationMode === "route-gated") {
    return routeAllowed(state, family);
  }

  if (family.activationMode === "step-gated") {
    return routeAllowed(state, family) && stepsAllowed(state, family);
  }

  if (family.activationMode === "latency-gated") {
    return latencyAllows(state, family);
  }

  if (family.activationMode === "intent-gated") {
    return routeAllowed(state, family);
  }

  if (family.activationMode === "domain-gated") {
    return true;
  }

  if (family.activationMode === "validation-gated") {
    return true;
  }

  return true;
}

