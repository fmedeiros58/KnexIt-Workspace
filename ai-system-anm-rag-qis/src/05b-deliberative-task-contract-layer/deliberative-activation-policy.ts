/**
 * Responsabilidade:
 * - Centralizar regras de ativacao deliberativa e promocao de rota.
 * - Expor decisoes puras reutilizaveis pelo bridge e por testes.
 */

import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import type { DeliberativeObligation } from "./deliberative-task-contract-types";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeText(value: unknown): string {
  return `${value || ""}`.toLowerCase().trim();
}

export function isGreetingFastLaneTurn(state: ProcessingState): boolean {
  if (state.preRouteSignals?.greetingFastLaneEligible) return true;

  const family = normalizeText(state.preRouteSignals?.greetingFamily);
  if (!family || family === "none") return false;

  const tokenCount =
    state.preRouteSignals?.tokenCount ??
    state.textAnalysisSnapshot?.tokenCount ??
    0;

  const questionCount =
    state.preRouteSignals?.questionCount ??
    state.textAnalysisSnapshot?.questionCount ??
    0;

  return tokenCount <= 12 && questionCount <= 1;
}

export function isDeepDescendingTurn(state: ProcessingState): boolean {
  const route = normalizeText(state.executionPlan.selectedRoute);

  if (route === "inferential" || route === "quantum-state") return true;

  if (route === "reflective") {
    return (state.complexityProfile.score || 0) >= 0.52;
  }

  if ((state.complexityProfile.depthRequired || 0) >= 8) return true;
  if ((state.complexityProfile.score || 0) >= 0.52) return true;

  return (state.executionPlan.steps || []).some((step) =>
    /general_task_deliberation|retrieval_augmented|reflective|inferential|deliberative_contract/i.test(
      `${step || ""}`,
    ),
  );
}

export function promoteDeliberativeRoute(currentRoute: PipelineRoute): PipelineRoute {
  switch (currentRoute) {
    case "quantum-state":
      return "quantum-state";

    case "inferential":
      return "inferential";

    case "reflective":
      return "inferential";

    case "minimum":
      return "inferential";

    default:
      return "inferential";
  }
}

export function buildActivationReasons(params: {
  greetingFastLaneTurn: boolean;
  deepDescendingTurn: boolean;
  obligationsCount: number;
  profile: {
    requiresDeliberativeContract: boolean;
    requiresStructuredCoverage: boolean;
    reasoningIntensity: number;
    taskArchetypes: string[];
  };
  depth: {
    requiresDeliberativeContract: boolean;
    needsStructuredCoverage: boolean;
    needsCounterObjection: boolean;
    needsAssumptionAudit: boolean;
  };
}): string[] {
  const reasons: string[] = [];

  if (params.greetingFastLaneTurn) reasons.push("greeting_fast_lane");
  if (params.deepDescendingTurn) reasons.push("deep_descending_turn");
  if (params.obligationsCount > 0) reasons.push("obligations_detected");

  if (params.profile.requiresDeliberativeContract) reasons.push("profile_requires_contract");
  if (params.depth.requiresDeliberativeContract) reasons.push("depth_requires_contract");

  if (params.profile.requiresStructuredCoverage) reasons.push("profile_requires_structured_coverage");
  if (params.depth.needsStructuredCoverage) reasons.push("depth_requires_structured_coverage");

  if (params.depth.needsCounterObjection) reasons.push("counter_objection_required");
  if (params.depth.needsAssumptionAudit) reasons.push("assumption_audit_required");

  if (clamp01(params.profile.reasoningIntensity) >= 0.55) {
    reasons.push("reasoning_intensity_high");
  }

  if ((params.profile.taskArchetypes || []).length >= 2) {
    reasons.push("multi_archetype_task");
  }

  return Array.from(new Set(reasons));
}

export function shouldBuildDeliberativeContract(params: {
  greetingFastLaneTurn: boolean;
  deepDescendingTurn: boolean;
  obligationsCount: number;
  profile: {
    requiresDeliberativeContract: boolean;
    requiresStructuredCoverage: boolean;
    reasoningIntensity: number;
    taskArchetypes: string[];
  };
  depth: {
    requiresDeliberativeContract: boolean;
    needsStructuredCoverage: boolean;
  };
}): boolean {
  if (params.greetingFastLaneTurn) return false;
  if (params.obligationsCount <= 0) return false;

  const reasoningIntensity = clamp01(params.profile.reasoningIntensity);
  const archetypeCount = (params.profile.taskArchetypes || []).length;
  const hardDemand =
    params.depth.requiresDeliberativeContract ||
    params.profile.requiresDeliberativeContract ||
    params.depth.needsStructuredCoverage ||
    params.profile.requiresStructuredCoverage;
  const strongMultiDemand =
    params.obligationsCount >= 2 ||
    archetypeCount >= 2 ||
    reasoningIntensity >= 0.55;

  if (hardDemand || strongMultiDemand) return true;
  if (params.deepDescendingTurn && (params.obligationsCount >= 2 || reasoningIntensity >= 0.52)) {
    return true;
  }
  return false;
}

export function buildFallbackObligation(prompt: string): DeliberativeObligation {
  const clippedPrompt = `${prompt || ""}`.trim().slice(0, 140);

  return {
    obligationId: "obl_fallback_1",
    label: `Responder a solicitacao do usuario com execucao real da tarefa, sem espelhar o enunciado: ${clippedPrompt}`,
    type: "evaluation",
    priority: 100,
    dependencies: [],
    satisfactionCriteria: [
      "execucao_real_da_tarefa",
      "sem_prompt_mirroring",
      "cobertura_estrutural_minima",
    ],
    minimumExpectedDepth: 0.62,
    coverageWeight: 1,
    evidenceHints: ["execucao_real", "sem_repeticao_do_prompt"],
  };
}
