/**
 * Responsabilidade do arquivo:
 * - Planejar rota, steps e parametros de execucao usando snapshot textual compartilhado.
 * - Atualizar executionPlan com rota efetiva e controles operacionais.
 * - Registrar trace detalhado de planejamento para auditabilidade.
 */
import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { buildTextAnalysisSnapshot } from "../shared/text-processing/text-analysis-snapshot";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { mergeConstraints, toConstraint } from "../shared/state/constraint-utils";
import { queryLengthScorer } from "./complexity-evaluator/query-length-scorer";
import { semanticComplexityScorer } from "./complexity-evaluator/semantic-complexity-scorer";
import { ambiguityScorer } from "./complexity-evaluator/ambiguity-scorer";
import { depthRequirementScorer } from "./complexity-evaluator/depth-requirement-scorer";
import { responseBudgetEstimator } from "./complexity-evaluator/response-budget-estimator";
import { chatMode } from "./mode-selector/chat-mode";
import { technicalMode } from "./mode-selector/technical-mode";
import { analysisMode } from "./mode-selector/analysis-mode";
import { writingMode } from "./mode-selector/writing-mode";
import { researchMode } from "./mode-selector/research-mode";
import { summaryMode } from "./mode-selector/summary-mode";
import { teachingMode } from "./mode-selector/teaching-mode";
import { routeRequest } from "./request-router";
import { singleStepPlan } from "./plan-builder/single-step-plan";
import { multiStepPlan } from "./plan-builder/multi-step-plan";
import { retrievalAugmentedPlan } from "./plan-builder/retrieval-augmented-plan";
import { mixedReasoningPlan } from "./plan-builder/mixed-reasoning-plan";
import { toolAugmentedPlan } from "./plan-builder/tool-augmented-plan";
import { dependencyResolver } from "./execution-coordinator/dependency-resolver";
import { stepSequencer } from "./execution-coordinator/step-sequencer";
import { timeoutGuard } from "./execution-coordinator/timeout-guard";
import { retryLogic } from "./execution-coordinator/retry-logic";
import { fallbackStrategyManager } from "./execution-coordinator/fallback-strategy-manager";
import { handoffOrchestrationToMemory } from "./orchestration-to-memory-bridge";
import { isConversationalPrompt } from "../shared/utils/conversation-signals";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function routeRank(route: PipelineRoute) {
  if (route === "minimum") return 0;
  if (route === "reflective") return 1;
  if (route === "inferential") return 2;
  return 3;
}

function countRecentFailures(state: ProcessingState) {
  return state.trace
    .slice(-24)
    .filter((item) => /(fallback|error|retry)/i.test(`${item.action} ${item.detail || ""}`))
    .length;
}

function toUniqueSteps(steps: string[]) {
  return [...new Set(steps)];
}

export async function runOrchestrationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const text = state.normalizedMessage || state.rawMessage;
  const snapshot = state.textAnalysisSnapshot ?? buildTextAnalysisSnapshot(text);
  state.textAnalysisSnapshot = snapshot;

  const regulatory = state.memorySnapshot.regulatoryState;
  const nodular = state.memorySnapshot.nodularState;
  const legacyRuntimeTop = state.memorySnapshot.legacyRuntimeTopModules || [];
  const legacyRuntimeMap = state.memorySnapshot.legacyRuntimeModules || {};

  const lengthScore = queryLengthScorer({ snapshot });
  const semanticScore = semanticComplexityScorer({ snapshot });
  const ambiguity = ambiguityScorer({ snapshot });

  const baseComplexityScore = clamp01(
    (lengthScore.score * 0.42) +
    (semanticScore.score * 0.40) +
    (ambiguity.score * 0.18),
  );

  const memoryComplexityBias = clamp01(
    (nodular.attention * 0.32) +
    (nodular.priming * 0.22) +
    (regulatory.stressLoad * 0.18) -
    (regulatory.contextStability * 0.10),
  );

  let complexityScore = clamp01(
    (baseComplexityScore * 0.84) +
    (memoryComplexityBias * 0.16),
  );

  const conversationalPrompt =
    isConversationalPrompt(text) || snapshot.hasGreetingSignal;

  if (conversationalPrompt) {
    complexityScore = Math.min(complexityScore, 0.28);
  }

  const modeCandidates = [
    chatMode({ text, complexityScore, intent: state.inputSignals.intent }),
    technicalMode({ text, complexityScore, intent: state.inputSignals.intent }),
    analysisMode({ text, complexityScore, ambiguityScore: ambiguity.score, intent: state.inputSignals.intent }),
    writingMode({ text, intent: state.inputSignals.intent }),
    researchMode({ text, intent: state.inputSignals.intent }),
    summaryMode({ text, intent: state.inputSignals.intent }),
    teachingMode({ text, intent: state.inputSignals.intent }),
  ];

  let selectedMode = modeCandidates.sort((a, b) => b.score - a.score)[0]?.mode ?? "chat";
  if (conversationalPrompt) selectedMode = "chat";

  const depth = depthRequirementScorer({
    complexityScore,
    ambiguityScore: ambiguity.score,
    intent: state.inputSignals.intent,
  });

  const budget = responseBudgetEstimator({
    complexityScore,
    depthRequired: depth.depthRequired,
    mode: selectedMode,
  });

  state.complexityProfile.score = complexityScore;
  state.complexityProfile.ambiguity = ambiguity.score;
  state.complexityProfile.depthRequired = depth.depthRequired;
  state.complexityProfile.responseBudget = budget.responseBudget;
  state.selectedMode = selectedMode;
  state.executionPlan.mode = selectedMode;
  state.executionPlan.maxDepth = depth.depthRequired;

  const routeHint = routeRequest(state);
  const originalRoute = state.executionPlan.selectedRoute;
  const routeElevated = routeRank(routeHint) > routeRank(originalRoute);

  let planningRoute: PipelineRoute = routeElevated ? routeHint : originalRoute;

  if (conversationalPrompt) planningRoute = "minimum";

  if (regulatory.blockStructuralConsolidation && planningRoute === "quantum-state") {
    planningRoute = "reflective";
  }

  if (
    legacyRuntimeTop.some((name) => name.includes("modular_") || name.includes("global_")) &&
    planningRoute === "minimum" &&
    complexityScore >= 0.33
  ) {
    planningRoute = "reflective";
  }

  const needRetrieval =
    planningRoute !== "minimum" ||
    complexityScore >= 0.38 ||
    ["research", "analysis", "technical"].includes(state.inputSignals.intent);

  const needWebSearch =
    planningRoute === "quantum-state" ||
    state.inputSignals.intent === "research" ||
    snapshot.hasRecencySignal;

  const needMemoryReinforcement =
    regulatory.stressLoad >= 0.62 ||
    nodular.priming >= 0.58 ||
    legacyRuntimeTop.some((name) => name === "working_memory" || name === "memory_manager");

  const singlePlan = singleStepPlan({ route: planningRoute, mode: selectedMode });
  const multiPlan = multiStepPlan({
    baseSteps: singlePlan.steps,
    depthRequired: depth.depthRequired,
  });
  const retrievalPlan = retrievalAugmentedPlan({
    steps: multiPlan.steps,
    needRetrieval,
  });
  const reasoningPlan = mixedReasoningPlan({
    steps: retrievalPlan.steps,
    route: planningRoute,
  });
  const toolPlan = toolAugmentedPlan({
    steps: needMemoryReinforcement
      ? [...reasoningPlan.steps, "memory_reinforcement"]
      : reasoningPlan.steps,
    mode: selectedMode,
    needWebSearch,
  });

  const resolved = dependencyResolver({ steps: toolPlan.steps });
  const sequenced = stepSequencer({
    resolvedSteps: resolved.resolvedSteps,
    maxDepth: depth.depthRequired,
  });

  const timeout = timeoutGuard({
    route: planningRoute,
    complexityScore,
  });

  const retry = retryLogic({
    route: planningRoute,
    complexityScore,
    urgency: state.inputSignals.urgency,
    priorFailureCount: countRecentFailures(state),
  });

  const fallback = fallbackStrategyManager({
    route: planningRoute,
    mode: selectedMode,
    complexityScore,
    ambiguity: ambiguity.score,
    safetyFlags: state.inputSignals.safetyFlags,
    hasSources: (state.retrievedSources.length + state.retrievedEvidence.length) > 0,
  });

  state.executionPlan.selectedRoute = planningRoute;
  state.executionPlan.steps = toUniqueSteps(sequenced.sequencedSteps);
  state.executionPlan.timeoutMs = timeout.timeoutMs;
  state.executionPlan.retryMaxAttempts = retry.maxAttempts;
  state.executionPlan.fallbackStrategy = fallback.primaryStrategy;

  state.activeConstraints = mergeConstraints(
    state.activeConstraints,
    [
      ...(routeElevated ? [toConstraint("route_hint", routeHint)] : []),
      ...(conversationalPrompt ? [toConstraint("route", "conversation_minimum_forced")] : []),
      toConstraint("fallback", fallback.primaryStrategy),
      toConstraint("retry_max_attempts", `${retry.maxAttempts}`),
      ...(needMemoryReinforcement ? [toConstraint("memory", "reinforcement_required")] : []),
      ...(regulatory.blockStructuralConsolidation ? [toConstraint("memory", "regulatory_gate_active")] : []),
      ...(nodular.attention >= 0.68 ? [toConstraint("nodular", "attention_priority")] : []),
      ...(legacyRuntimeTop.length ? [toConstraint("legacy_runtime_top", legacyRuntimeTop.slice(0, 2).join(","))] : []),
      ...fallback.guardrails.map((item) => toConstraint("guardrail", item)),
    ],
    32,
  );

  state.timings.orchestrationTimeoutMs = timeout.timeoutMs;
  state.timings.orchestrationRetryBackoffMs = retry.backoffMs;

  state.executionArtifacts.orchestration = {
    selectedMode,
    planningRoute,
    routeHint,
    complexityScore,
    ambiguityScore: ambiguity.score,
    needRetrieval,
    needWebSearch,
    needMemoryReinforcement,
    timeoutMs: timeout.timeoutMs,
    retryMaxAttempts: retry.maxAttempts,
    fallbackStrategy: fallback.primaryStrategy,
    steps: [...state.executionPlan.steps],
  };

  state.trace.push(
    makeTraceEvent({
      layer: "orchestration",
      action: "orchestration_planned",
      route: planningRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `score=${complexityScore.toFixed(3)}; ambiguity=${ambiguity.score.toFixed(3)}; mode=${selectedMode}; routeHint=${routeHint}; ` +
        `planRoute=${planningRoute}; steps=${state.executionPlan.steps.length}; fallback=${fallback.primaryStrategy}; retry=${retry.maxAttempts}; ` +
        `tokens=${snapshot.tokenCount}; sentences=${snapshot.sentenceCount}; verifiable=${snapshot.hasVerifiableSignal}; recency=${snapshot.hasRecencySignal}; ` +
        `memoryBias=${memoryComplexityBias.toFixed(2)}; stress=${regulatory.stressLoad.toFixed(2)}; nodularAttention=${nodular.attention.toFixed(2)}; ` +
        `legacyTop=${legacyRuntimeTop.slice(0, 2).join(",")}; memoryManager=${(legacyRuntimeMap.memory_manager || 0).toFixed(2)}`,
    }),
  );

  return handoffOrchestrationToMemory(state);
}
