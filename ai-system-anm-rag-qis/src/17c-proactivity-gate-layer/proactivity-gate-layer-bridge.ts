/** ai-system-anm - bridge 17c */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { analyzeInterruptionRisk } from "./interruption-risk-analyzer";
import { checkContextualRelevance } from "./contextual-relevance-checker";
import { decideProactivity } from "./proactivity-decision-engine";

export async function runProactivityGateLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
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

  state.proactivityDecisionState = {
    allowProactivity: decision.allowProactivity,
    interruptionRisk,
    relevanceScore,
    rationale: decision.rationale,
  };

  state.executionArtifacts.proactivityGate = {
    allowProactivity: decision.allowProactivity,
    interruptionRisk,
    relevanceScore,
    rationale: decision.rationale,
  };

  state.trace.push(
    makeTraceEvent({
      layer: "proactivity-gate",
      action: "proactivity_decision_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `allow=${decision.allowProactivity}; risk=${interruptionRisk.toFixed(2)}; relevance=${relevanceScore.toFixed(2)}`,
    }),
  );

  return state;
}
