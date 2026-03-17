import type { ProcessingState } from "../bridges/contracts/processing-state";

export async function runFeedbackSqlBridge(state: ProcessingState): Promise<ProcessingState> {
  const feedbackEvent = {
    at: new Date().toISOString(),
    route: state.executionPlan.selectedRoute,
    mode: state.executionPlan.mode,
    decision: state.validationReport.quality.decision,
    quality: state.validationReport.quality.score,
    factualOk: state.validationReport.factual.ok,
    policyOk: state.validationReport.policy.ok,
    structureOk: state.validationReport.structure.ok,
  };

  const existing = Array.isArray(state.userProfile.feedbackEvents)
    ? (state.userProfile.feedbackEvents as unknown[])
    : [];

  state.userProfile = {
    ...state.userProfile,
    feedbackEvents: [...existing, feedbackEvent].slice(-30),
  };

  return state;
}
