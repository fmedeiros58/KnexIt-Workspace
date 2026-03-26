import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { selfMonitor } from "./self-monitor";
import { overconfidenceDetector } from "./overconfidence-detector";
import { completionSufficiencyChecker } from "./completion-sufficiency-checker";
import { handoffMetacognitiveToEpistemicIntegration } from "./metacognitive-to-epistemic-integration-bridge";
import { runPhilosophicalSelfModelingBridge } from "./philosophical-self-modeling/philosophical-self-modeling-bridge";

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
  await runPhilosophicalSelfModelingBridge(state);
  const philosophicalNotes = state.philosophicalSelfModelState?.consistencyNotes || [];
  const philosophicalNeedsRevision = state.philosophicalSelfModelState ? !state.philosophicalSelfModelState.consistencyOk : false;

  state.metacognitiveState = {
    depthAdequate: monitor.depthAdequate,
    monitorScore: monitor.monitorScore,
    overconfidenceRisk: overconfidence.risk,
    revisionNeeded: overconfidence.flagged || !sufficiency.sufficient || philosophicalNeedsRevision,
    notes: [
      ...sufficiency.notes,
      ...(overconfidence.flagged ? ["overconfidence_risk"] : []),
      ...philosophicalNotes.map((item) => `philosophical:${item}`),
    ],
  };
  state.activeConstraints = [
      ...new Set([
        ...state.activeConstraints,
        ...(monitor.depthAdequate ? [] : ["metacognitive_depth_review"]),
        ...(overconfidence.flagged ? ["metacognitive_overconfidence_guard"] : []),
        ...(philosophicalNeedsRevision ? ["metacognitive_philosophical_reconciliation"] : []),
        ...sufficiency.notes.map((note) => `metacognitive:${note}`),
      ]),
    ].slice(-32);

  state.trace.push(
    makeTraceEvent({
      layer: "metacognitive",
      action: "self_regulation_applied",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `depthAdequate=${monitor.depthAdequate}; overconfidence=${overconfidence.risk.toFixed(2)}; ` +
        `revision=${state.metacognitiveState.revisionNeeded}; philosophical=${state.philosophicalSelfModelState ? "on" : "off"}`,
    }),
  );

  return handoffMetacognitiveToEpistemicIntegration(state);
}
