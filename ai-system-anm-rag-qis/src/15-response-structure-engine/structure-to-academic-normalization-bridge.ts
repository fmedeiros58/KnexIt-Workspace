import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const STRUCTURE_TO_ACADEMIC_CONTRACT = {
  from: "structure",
  to: "academic-normalization",
  requiredFields: ["structuredResponse"],
} as const;

export function handoffStructureToAcademicNormalization(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, STRUCTURE_TO_ACADEMIC_CONTRACT);
  return state;
}
