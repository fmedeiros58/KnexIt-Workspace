import type { ProcessingState } from "../bridges/contracts/processing-state";

function compact(value: string, maxChars = 220) {
  const safe = value.replace(/\s+/g, " ").trim();
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars - 1)}...`;
}

export async function runGenerationEvidenceBridge(state: ProcessingState): Promise<ProcessingState> {
  const dedupedEvidence = [...new Set(state.retrievedEvidence.map((item) => compact(item)))].slice(0, 16);
  state.retrievedEvidence = dedupedEvidence;

  if (dedupedEvidence.length === 0) {
    state.activeConstraints = [...state.activeConstraints, "low_evidence_generation_mode"].slice(-16);
  }

  state.userProfile = {
    ...state.userProfile,
    generationEvidence: {
      evidenceCount: dedupedEvidence.length,
      sourceCount: state.retrievedSources.length,
    },
  };

  return state;
}
