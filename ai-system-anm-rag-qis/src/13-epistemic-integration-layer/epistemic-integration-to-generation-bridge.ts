import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const EPISTEMIC_INTEGRATION_TO_GENERATION_CONTRACT = {
  from: "epistemic-integration",
  to: "generation",
  requiredFields: ["collapsedTruth", "inferentialMap", "reflectiveNotes"],
} as const;

export function handoffEpistemicIntegrationToGeneration(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, EPISTEMIC_INTEGRATION_TO_GENERATION_CONTRACT);
  return state;
}
