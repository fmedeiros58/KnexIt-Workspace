/**
 * Responsabilidade do arquivo:
 * - Executar fluxo descendente com gates por politica, steps, latencia e safety.
 * - Aplicar short-circuit de seguranca antes de camadas profundas.
 * - Rodar validacao progressiva (pre_presentation e final) com rastreabilidade.
 */
import type { PipelineLayerId, PipelineRoute } from "../shared/enums/pipeline-enums";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { pushLayerDecisionTrace } from "../shared/utils/trace-decision-utils";
import { ROUTE_EXECUTION_POLICY } from "./pipeline-route-policy";
import {
  shouldRunInferentialLayer,
  shouldRunKnowledgeLayer,
  shouldRunQuantumLayer,
  shouldRunReflectiveLayer,
} from "./pipeline-step-gates";
import {
  shouldRunAcademicByLatency,
  shouldRunInferentialByLatency,
  shouldRunKnowledgeByLatency,
  shouldRunQuantumByLatency,
  shouldRunReflectiveByLatency,
} from "./pipeline-latency-gates";
import { resolveSafetyShortCircuit } from "../shared/safety/safety-short-circuit";
import { bumpLayerFailed, createObservabilityMetricsStore } from "../19-observability-control-and-admin-layer/observability-metrics-store";

import { runInputLayer } from "../01-input-layer/input-layer-bridge";
import { runLanguageLayer } from "../02-language-layer/language-layer-bridge";
import { runConversationLayer } from "../03-conversation-layer/conversation-layer-bridge";
import { runAffectiveSignalLayer } from "../06b-affective-signal-layer/affective-signal-layer-bridge";
import { runContextLayer } from "../04-context-and-session-layer/context-layer-bridge";
import { runOrchestrationLayer } from "../05-complexity-and-orchestration-layer/orchestration-layer-bridge";
import { runMemoryLayer } from "../06-memory-and-plasticity-layer/memory-layer-bridge";
import { runResponsePlanningLayer } from "../09b-response-planning-layer/response-planning-layer-bridge";
import { runKnowledgeLayer } from "../07-knowledge-retrieval-and-research-layer/knowledge-layer-bridge";
import { runQuantumLayer } from "../08-quantum-information-state-layer/quantum-layer-bridge";
import { runPreparatoryCognitiveLayer } from "../09-preparatory-cognitive-layer/preparatory-cognitive-layer-bridge";
import { runReflectiveLayer } from "../10-reflective-layer/reflective-layer-bridge";
import { runInferentialLayer } from "../11-inferential-layer/inferential-layer-bridge";
import { runMetacognitiveLayer } from "../12-metacognitive-layer/metacognitive-layer-bridge";
import { runEpistemicIntegrationLayer } from "../13-epistemic-integration-layer/epistemic-integration-layer-bridge";
import { runGenerationLayer } from "../14-reasoning-and-generation-layer/generation-layer-bridge";
import { runStructureLayer } from "../15-response-structure-engine/structure-layer-bridge";
import { runAcademicNormalizationLayer } from "../16-academic-normalization-layer/academic-layer-bridge";
import { runValidationLayer } from "../17-validation-layer/validation-layer-bridge";
import { runResponseBehaviorLayer } from "../17b-response-behavior-layer/response-behavior-layer-bridge";
import { runProactivityGateLayer } from "../17c-proactivity-gate-layer/proactivity-gate-layer-bridge";
import { runDeliveryProfileLayer } from "../17d-delivery-profile-layer/delivery-profile-layer-bridge";
import { runLinguisticHumanizerLayer } from "../17e-linguistic-humanizer-layer/linguistic-humanizer-layer-bridge";
import { runResponseCalibrationLayer } from "../17f-response-calibration-layer/response-calibration-layer-bridge";
import { runPresentationLayer } from "../18-presentation-and-delivery-layer/presentation-layer-bridge";
import { runObservabilityLayer } from "../19-observability-control-and-admin-layer/observability-layer-bridge";
import { runFeedbackLayer } from "../20-feedback-learning-and-memory-update-layer/feedback-layer-bridge";

function isReflectiveAlwaysOn(): boolean {
  const flag = `${process.env.AI_SYSTEM_REFLECTIVE_ALWAYS_ON || ""}`.trim().toLowerCase();
  if (!flag) return true;
  return !(flag === "0" || flag === "false" || flag === "off");
}

export async function runDescendingFlow(initialState: ProcessingState, route: PipelineRoute): Promise<ProcessingState> {
  let state = initialState;
  let effectiveRoute: PipelineRoute = route;
  let policy = ROUTE_EXECUTION_POLICY[effectiveRoute];

  state.executionPlan.selectedRoute = effectiveRoute;
  state.executionPlan.validationProfile = policy.validationProfile;
  state.executionPlan.pruningMode = policy.pruningMode;

  const executed: string[] = [];
  const skipped: string[] = [];

  const runIf = async (
    condition: boolean,
    layerId: PipelineLayerId,
    displayName: string,
    runner: (current: ProcessingState) => Promise<ProcessingState>,
    skipReason: string,
  ) => {
    if (!condition) {
      skipped.push(displayName);
      pushLayerDecisionTrace(state, {
        layer: layerId,
        route: effectiveRoute,
        status: "skipped",
        reason: skipReason,
      });
      return;
    }

    const startedAt = Date.now();
    try {
      state = await runner(state);
      executed.push(displayName);

      pushLayerDecisionTrace(state, {
        layer: layerId,
        route: effectiveRoute,
        status: "executed",
        reason: "layer_executed",
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      state.observabilityMetrics = state.observabilityMetrics || createObservabilityMetricsStore();
      bumpLayerFailed(state.observabilityMetrics, layerId);
      state.trace.push(
        makeTraceEvent({
          layer: layerId,
          action: "layer_failed",
          route: effectiveRoute,
          latencyMs: Date.now() - startedAt,
          detail: `reason=${error instanceof Error ? error.message : "unknown_error"}`,
        }),
      );
      throw error;
    }
  };

  await runIf(policy.runInput, "input", "input", runInputLayer, "route_policy_disabled");
  await runIf(policy.runLanguage, "language", "language", runLanguageLayer, "route_policy_disabled");
  await runIf(policy.runConversation, "conversation", "conversation", runConversationLayer, "route_policy_disabled");
  await runIf(
    policy.runAffectiveSignal,
    "affective-signal",
    "affective-signal",
    runAffectiveSignalLayer,
    "route_policy_disabled",
  );
  await runIf(policy.runContext, "context", "context", runContextLayer, "route_policy_disabled");
  await runIf(policy.runOrchestration, "orchestration", "orchestration", runOrchestrationLayer, "route_policy_disabled");
  await runIf(policy.runMemory, "memory", "memory", runMemoryLayer, "route_policy_disabled");
  await runIf(
    policy.runResponsePlanning,
    "response-planning",
    "response-planning",
    runResponsePlanningLayer,
    "route_policy_disabled",
  );

  effectiveRoute = state.executionPlan.selectedRoute || route;
  policy = ROUTE_EXECUTION_POLICY[effectiveRoute];
  state.executionPlan.selectedRoute = effectiveRoute;
  state.executionPlan.validationProfile = policy.validationProfile;
  state.executionPlan.pruningMode = policy.pruningMode;

  const safetyShortCircuit = resolveSafetyShortCircuit(state);
  if (safetyShortCircuit.shouldShortCircuit && safetyShortCircuit.forcedRoute) {
    effectiveRoute = safetyShortCircuit.forcedRoute;
    policy = ROUTE_EXECUTION_POLICY[effectiveRoute];
    state.executionPlan.selectedRoute = effectiveRoute;
    state.executionPlan.validationProfile = policy.validationProfile;
    state.executionPlan.pruningMode = policy.pruningMode;
  }

  const safetyBlocksDeepLayers = safetyShortCircuit.shouldShortCircuit;

  const knowledgeByPolicy = policy.runKnowledge;
  const knowledgeBySteps = shouldRunKnowledgeLayer(state);
  const knowledgeByLatency = shouldRunKnowledgeByLatency(state, effectiveRoute);
  const knowledgeAllowed = knowledgeByPolicy && knowledgeBySteps && knowledgeByLatency && !safetyBlocksDeepLayers;

  const quantumByPolicy = policy.runQuantum;
  const quantumBySteps = shouldRunQuantumLayer(state);
  const quantumByLatency = shouldRunQuantumByLatency(state, effectiveRoute);
  const quantumAllowed = quantumByPolicy && quantumBySteps && quantumByLatency && !safetyBlocksDeepLayers;

  const reflectiveAlwaysOn = isReflectiveAlwaysOn();
  const reflectiveByPolicy = policy.runReflective;
  const reflectiveBySteps = shouldRunReflectiveLayer(state);
  const reflectiveByLatency = shouldRunReflectiveByLatency(state, effectiveRoute);
  const reflectiveAllowed =
    reflectiveByPolicy &&
    !safetyBlocksDeepLayers &&
    (reflectiveAlwaysOn || (reflectiveBySteps && reflectiveByLatency));

  const inferentialByPolicy = policy.runInferential;
  const inferentialBySteps = shouldRunInferentialLayer(state);
  const inferentialByLatency = shouldRunInferentialByLatency(state, effectiveRoute);
  const inferentialAllowed = inferentialByPolicy && inferentialBySteps && inferentialByLatency && !safetyBlocksDeepLayers;

  const academicByPolicy = policy.runAcademicNormalization;
  const academicByLatency = shouldRunAcademicByLatency(state, effectiveRoute);
  const academicAllowed = academicByPolicy && academicByLatency && !safetyBlocksDeepLayers;

  await runIf(
    knowledgeAllowed,
    "knowledge",
    "knowledge",
    runKnowledgeLayer,
    safetyBlocksDeepLayers
      ? "safety_short_circuit"
      : !knowledgeByPolicy
        ? "route_policy_disabled"
        : !knowledgeBySteps
          ? "knowledge_step_not_planned"
          : "latency_budget_exceeded",
  );

  await runIf(
    quantumAllowed,
    "quantum",
    "quantum",
    runQuantumLayer,
    safetyBlocksDeepLayers
      ? "safety_short_circuit"
      : !quantumByPolicy
        ? "route_policy_disabled"
        : !quantumBySteps
          ? "quantum_step_not_planned"
          : "latency_budget_exceeded",
  );

  await runIf(
    policy.runPreparatoryCognitive && !safetyBlocksDeepLayers,
    "preparatory",
    "preparatory-cognitive",
    runPreparatoryCognitiveLayer,
    safetyBlocksDeepLayers ? "safety_short_circuit" : "route_policy_disabled",
  );

  await runIf(
    reflectiveAllowed,
    "reflective",
    "reflective",
    runReflectiveLayer,
    safetyBlocksDeepLayers
      ? "safety_short_circuit"
      : !reflectiveByPolicy
        ? "route_policy_disabled"
        : !reflectiveAlwaysOn && !reflectiveBySteps
          ? "reflective_step_not_planned"
          : !reflectiveAlwaysOn && !reflectiveByLatency
            ? "latency_budget_exceeded"
            : "reflective_forced_disabled",
  );

  await runIf(
    inferentialAllowed,
    "inferential",
    "inferential",
    runInferentialLayer,
    safetyBlocksDeepLayers
      ? "safety_short_circuit"
      : !inferentialByPolicy
        ? "route_policy_disabled"
        : !inferentialBySteps
          ? "inferential_step_not_planned"
          : "latency_budget_exceeded",
  );

  await runIf(
    policy.runMetacognitive && !safetyBlocksDeepLayers,
    "metacognitive",
    "metacognitive",
    runMetacognitiveLayer,
    safetyBlocksDeepLayers ? "safety_short_circuit" : "route_policy_disabled",
  );

  await runIf(
    policy.runEpistemicIntegration && !safetyBlocksDeepLayers,
    "epistemic-integration",
    "epistemic-integration",
    runEpistemicIntegrationLayer,
    safetyBlocksDeepLayers ? "safety_short_circuit" : "route_policy_disabled",
  );

  await runIf(policy.runGeneration, "generation", "generation", runGenerationLayer, "route_policy_disabled");
  await runIf(policy.runStructure, "structure", "structure", runStructureLayer, "route_policy_disabled");

  await runIf(
    academicAllowed,
    "academic-normalization",
    "academic-normalization",
    runAcademicNormalizationLayer,
    safetyBlocksDeepLayers
      ? "safety_short_circuit"
      : !academicByPolicy
        ? "route_policy_disabled"
        : "latency_budget_exceeded",
  );

  state.executionArtifacts.validationStage = "pre_presentation";
  await runIf(true, "validation", "validation", runValidationLayer, "validation_always_required");

  await runIf(
    policy.runResponseBehavior,
    "response-behavior",
    "response-behavior",
    runResponseBehaviorLayer,
    "route_policy_disabled",
  );
  await runIf(
    policy.runProactivityGate,
    "proactivity-gate",
    "proactivity-gate",
    runProactivityGateLayer,
    "route_policy_disabled",
  );
  await runIf(
    policy.runDeliveryProfile,
    "delivery-profile",
    "delivery-profile",
    runDeliveryProfileLayer,
    "route_policy_disabled",
  );
  await runIf(
    policy.runLinguisticHumanizer,
    "linguistic-humanizer",
    "linguistic-humanizer",
    runLinguisticHumanizerLayer,
    "route_policy_disabled",
  );
  await runIf(
    policy.runResponseCalibration,
    "response-calibration",
    "response-calibration",
    runResponseCalibrationLayer,
    "route_policy_disabled",
  );

  state.executionArtifacts.validationStage = "final";
  await runIf(true, "validation-final", "validation-final", runValidationLayer, "validation_always_required");

  await runIf(policy.runPresentation, "presentation", "presentation", runPresentationLayer, "route_policy_disabled");

  await runIf(policy.runObservability, "observability", "observability", runObservabilityLayer, "route_policy_disabled");
  await runIf(policy.runFeedback, "feedback", "feedback", runFeedbackLayer, "route_policy_disabled");

  state.trace.push(
    makeTraceEvent({
      layer: "pipeline",
      action: "descending_flow_executed",
      route: effectiveRoute,
      latencyMs: 0,
      detail:
        `executed=${executed.join(",")}; skipped=${skipped.join(",")}; ` +
        `validationProfile=${policy.validationProfile}; pruning=${policy.pruningMode}; ` +
        `safetyShortCircuit=${safetyShortCircuit.shouldShortCircuit}; safetyReason=${safetyShortCircuit.reason}`,
    }),
  );

  return state;
}

