import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const ACADEMIC_TO_VALIDATION_CONTRACT = {
  from: "academic-normalization",
  to: "validation",
  requiredFields: ["structuredResponse"],
} as const;

export function handoffAcademicToValidation(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, ACADEMIC_TO_VALIDATION_CONTRACT);
  return state;
}
