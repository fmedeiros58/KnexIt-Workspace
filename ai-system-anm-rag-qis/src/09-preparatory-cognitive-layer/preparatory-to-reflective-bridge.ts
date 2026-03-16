import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const PREPARATORY_TO_REFLECTIVE_CONTRACT = {
  from: "preparatory",
  to: "reflective",
  requiredFields: ["executionPlan", "complexityProfile", "activeConstraints"],
} as const;

export function handoffPreparatoryToReflective(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, PREPARATORY_TO_REFLECTIVE_CONTRACT);
  return state;
}
