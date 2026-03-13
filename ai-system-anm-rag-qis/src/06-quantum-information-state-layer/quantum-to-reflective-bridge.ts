import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const QUANTUM_TO_REFLECTIVE_CONTRACT = {
  from: "quantum",
  to: "reflective",
  requiredFields: ["hypothesisSet", "collapsedTruth", "epistemicStatus"],
} as const;

export function handoffQuantumToReflective(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, QUANTUM_TO_REFLECTIVE_CONTRACT);
  return state;
}
