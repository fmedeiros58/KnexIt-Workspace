import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const REFLECTIVE_TO_INFERENTIAL_CONTRACT = {
  from: "reflective",
  to: "inferential",
  requiredFields: ["reflectiveNotes", "criticalCaveats"],
} as const;

export function handoffReflectiveToInferential(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, REFLECTIVE_TO_INFERENTIAL_CONTRACT);
  return state;
}
