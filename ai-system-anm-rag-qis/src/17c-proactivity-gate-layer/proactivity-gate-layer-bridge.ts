/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17c-proactivity-gate-layer
 * Module: proactivity-gate-layer-bridge
 * Responsibility: Decide whether the response may include proactive extensions after behavior shaping.
 * Primary Inputs: ProcessingState, validated surface and adaptive proactivity-gate layer mode.
 * Primary Outputs: ProactivityDecisionState.
 * Upstream Dependencies: behavior layer, local interruption/relevance analyzers, threshold resolver
 * Downstream Dependencies: delivery profile, humanizer, calibration
 * Invariants: Proactivity remains gated locally and never bypasses the descending response pipeline.
 * Failure Modes: Missing adaptive signals degrade to conservative thresholding.
 * Audit Events: proactivity_decision_built
 * Notes: Threshold resolution is local to this layer, not centralized in orchestration.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveLayerModeFromState } from "../05-complexity-and-orchestration-layer/activation-policy/layer-mode-resolver";
import { analyzeInterruptionRisk } from "./interruption-risk-analyzer";
import { checkContextualRelevance } from "./contextual-relevance-checker";
import { decideProactivity } from "./proactivity-decision-engine";
import { proactivityThresholdResolver } from "./operators/proactivity-threshold-resolver";

export async function runProactivityGateLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const proactivityMode = resolveLayerModeFromState(state, "proactivity-gate");
  const validatedDraft = `${state.validatedDraft || state.structuredResponse || ""}`;

  const interruptionRisk = analyzeInterruptionRisk({
    validatedDraft,
    cautionLevel: state.affectiveState.cautionLevel,
    needsClarification: state.conversationState.needsClarification,
  });
  const relevanceScore = checkContextualRelevance({
    userMessage: state.normalizedMessage || state.rawMessage,
    draft: validatedDraft,
  });
  const decision = decideProactivity({
    interruptionRisk,
    relevanceScore,
    questionFrequencyCap: state.behaviorPersonalityState.questionFrequencyCap,
    selectedMode: state.selectedMode,
  });
  const thresholds = proactivityThresholdResolver(state, proactivityMode);
  const allowProactivity =
    decision.allowProactivity &&
    interruptionRisk <= thresholds.maxInterruptionRisk &&
    relevanceScore >= thresholds.minRelevanceScore;
  const rationale = allowProactivity
    ? `${decision.rationale}; mode=${proactivityMode}; thresholds=ok`
    : `${decision.rationale}; mode=${proactivityMode}; blocked_by_thresholds=${thresholds.rationale.join(",")}`;

  state.proactivityDecisionState = {
    allowProactivity,
    interruptionRisk,
    relevanceScore,
    rationale,
  };

  state.executionArtifacts.proactivityGate = {
    allowProactivity,
    interruptionRisk,
    relevanceScore,
    rationale,
  };

  state.trace.push(
    makeTraceEvent({
      layer: "proactivity-gate",
      action: "proactivity_decision_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `mode=${proactivityMode}; allow=${allowProactivity}; risk=${interruptionRisk.toFixed(2)}; ` +
        `relevance=${relevanceScore.toFixed(2)}; maxRisk=${thresholds.maxInterruptionRisk.toFixed(2)}; ` +
        `minRel=${thresholds.minRelevanceScore.toFixed(2)}`,
    }),
  );

  return state;
}
