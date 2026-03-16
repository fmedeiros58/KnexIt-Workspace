import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { selfMonitor } from "./self-monitor";
import { overconfidenceDetector } from "./overconfidence-detector";
import { completionSufficiencyChecker } from "./completion-sufficiency-checker";
import { handoffMetacognitiveToEpistemicIntegration } from "./metacognitive-to-epistemic-integration-bridge";

export async function runMetacognitiveLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  const monitor = selfMonitor({
    route: state.executionPlan.selectedRoute,
    confidence: state.confidenceScores.final,
    uncertainty: state.collapsedTruth.uncertainty,
  });
  const overconfidence = overconfidenceDetector({
    confidence: state.confidenceScores.epistemic,
    uncertainty: state.collapsedTruth.uncertainty,
    evidenceCount: state.retrievedSources.length,
  });
  const sufficiency = completionSufficiencyChecker({
    structuredResponse: state.structuredResponse || state.draftResponse.text,
    implicationsCount: state.inferentialMap.implications.length,
  });

  state.metacognitiveState = {
    depthAdequate: monitor.depthAdequate,
    monitorScore: monitor.monitorScore,
    overconfidenceRisk: overconfidence.risk,
    revisionNeeded: overconfidence.flagged || !sufficiency.sufficient,
    notes: [...sufficiency.notes, ...(overconfidence.flagged ? ["overconfidence_risk"] : [])],
  };
  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      ...(monitor.depthAdequate ? [] : ["metacognitive_depth_review"]),
      ...(overconfidence.flagged ? ["metacognitive_overconfidence_guard"] : []),
      ...sufficiency.notes.map((note) => `metacognitive:${note}`),
    ]),
  ].slice(-32);

  state.trace.push(
    makeTraceEvent({
      layer: "metacognitive",
      action: "self_regulation_applied",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `depthAdequate=${monitor.depthAdequate}; overconfidence=${overconfidence.risk.toFixed(2)}; revision=${state.metacognitiveState.revisionNeeded}`,
    }),
  );

  return handoffMetacognitiveToEpistemicIntegration(state);
}
