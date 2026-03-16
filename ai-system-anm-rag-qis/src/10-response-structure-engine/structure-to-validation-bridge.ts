import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const STRUCTURE_TO_VALIDATION_CONTRACT = {
  from: "structure",
  to: "validation",
  requiredFields: ["structuredResponse"],
} as const;

export function handoffStructureToValidation(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, STRUCTURE_TO_VALIDATION_CONTRACT);
  return state;
}
