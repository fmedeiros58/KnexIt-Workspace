import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const VALIDATION_TO_PRESENTATION_CONTRACT = {
  from: "validation",
  to: "presentation",
  requiredFields: ["validationReport", "structuredResponse"],
} as const;

export function handoffValidationToPresentation(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, VALIDATION_TO_PRESENTATION_CONTRACT);
  return state;
}
