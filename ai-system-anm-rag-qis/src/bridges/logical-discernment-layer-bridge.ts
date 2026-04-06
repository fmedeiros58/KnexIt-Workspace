import type { ProcessingState } from "./contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { runLogicalDiscernmentEngine } from "../cognition/logical-discernment/logical-discernment-engine";

export async function runLogicalDiscernmentLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  state.trace.push(
    makeTraceEvent({
      layer: "logical-discernment",
      action: "logical_discernment_started",
      route: state.executionPlan.selectedRoute,
      latencyMs: 0,
      detail: "pre_orchestration_logical_analysis",
    }),
  );

  const pragmatic = (state.languageState as ProcessingState["languageState"] & Record<string, any>).pragmatic || {};
  const result = runLogicalDiscernmentEngine({
    message: state.rawMessage,
    normalizedMessage: state.normalizedMessage,
    pragmaticIntent: `${state.languageState.primaryIntent || pragmatic.intent || ""}`,
    speechAct: `${state.languageState.speechAct || ""}`,
    directiveForce: typeof pragmatic.directiveForce === "number" ? pragmatic.directiveForce : 0,
    tokenCount: state.preRouteSignals?.tokenCount || state.textAnalysisSnapshot?.tokenCount || 0,
    questionCount: state.preRouteSignals?.questionCount || state.textAnalysisSnapshot?.questionCount || 0,
    hasGreetingSignal: state.preRouteSignals?.hasGreetingSignal || state.textAnalysisSnapshot?.hasGreetingSignal,
    recentTurns: state.recentTurns,
  });

  state.logicalFrame = result.frame;
  state.logicalDiscernmentScore = result.score;
  state.dominantPrinciple = result.frame.dominantPrinciple;
  state.recommendedPracticalAction = result.frame.recommendedAction;
  state.practicalReasoningFlags = result.flags;

  if (result.frame.shouldAffectRouting || result.frame.shouldAffectRetrieval) {
    state.trace.push(
      makeTraceEvent({
        layer: "logical-discernment",
        action: "logical_routing_bias_applied",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail:
          `principle=${result.frame.dominantPrinciple}; affectRouting=${result.frame.shouldAffectRouting}; ` +
          `affectRetrieval=${result.frame.shouldAffectRetrieval}`,
      }),
    );
  }

  state.executionArtifacts = {
    ...state.executionArtifacts,
    logicalDiscernment: {
      dominantPrinciple: result.frame.dominantPrinciple,
      score: result.score,
      shouldAffectRouting: result.frame.shouldAffectRouting,
      shouldAffectRetrieval: result.frame.shouldAffectRetrieval,
      shouldTriggerOutputAudit: result.frame.shouldTriggerOutputAudit,
      recommendedAction: result.frame.recommendedAction,
      flags: result.flags,
    },
  };

  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      `logical_principle:${result.frame.dominantPrinciple}`,
      ...(result.frame.shouldAffectRouting ? ["logical_affect_routing"] : []),
      ...(result.frame.shouldAffectRetrieval ? ["logical_affect_retrieval"] : []),
    ]),
  ].slice(-40);

  state.trace.push(
    makeTraceEvent({
      layer: "logical-discernment",
      action: "logical_frame_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `principle=${result.frame.dominantPrinciple}; confidence=${result.frame.confidence.toFixed(2)}; ` +
        `actions=${result.frame.feasibleActions.length}; rejected=${result.frame.rejectedActions.length}`,
    }),
  );

  return state;
}
