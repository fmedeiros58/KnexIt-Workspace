import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const METACOGNITIVE_TO_EPISTEMIC_INTEGRATION_CONTRACT = {
  from: "metacognitive",
  to: "epistemic-integration",
  requiredFields: ["collapsedTruth", "confidenceScores", "activeConstraints"],
} as const;

export function handoffMetacognitiveToEpistemicIntegration(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, METACOGNITIVE_TO_EPISTEMIC_INTEGRATION_CONTRACT);
  return state;
}
