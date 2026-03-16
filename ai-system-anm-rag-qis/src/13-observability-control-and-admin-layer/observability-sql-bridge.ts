import type { ProcessingState } from "../bridges/contracts/processing-state";

export async function runObservabilitySqlBridge(state: ProcessingState): Promise<ProcessingState> {
  const snapshot = {
    at: new Date().toISOString(),
    route: state.executionPlan.selectedRoute,
    mode: state.executionPlan.mode,
    quality: state.validationReport.quality.score,
    confidence: state.confidenceScores.final,
  };

  const existing = Array.isArray(state.userProfile.observabilityEvents)
    ? (state.userProfile.observabilityEvents as unknown[])
    : [];

  state.userProfile = {
    ...state.userProfile,
    observabilityEvents: [...existing, snapshot].slice(-20),
  };

  return state;
}
