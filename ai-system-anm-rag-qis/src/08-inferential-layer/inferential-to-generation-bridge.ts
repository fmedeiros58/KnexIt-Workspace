import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const INFERENTIAL_TO_GENERATION_CONTRACT = {
  from: "inferential",
  to: "generation",
  requiredFields: ["inferentialMap", "collapsedTruth"],
} as const;

export function handoffInferentialToGeneration(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, INFERENTIAL_TO_GENERATION_CONTRACT);
  return state;
}
