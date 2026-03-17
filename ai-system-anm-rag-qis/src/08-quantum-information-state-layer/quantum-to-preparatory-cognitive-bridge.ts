import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const QUANTUM_TO_PREPARATORY_CONTRACT = {
  from: "quantum",
  to: "preparatory",
  requiredFields: ["hypothesisSet", "collapsedTruth", "epistemicStatus"],
} as const;

export function handoffQuantumToPreparatoryCognitive(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, QUANTUM_TO_PREPARATORY_CONTRACT);
  return state;
}
