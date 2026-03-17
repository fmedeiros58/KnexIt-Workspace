import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const INFERENTIAL_TO_METACOGNITIVE_CONTRACT = {
  from: "inferential",
  to: "metacognitive",
  requiredFields: ["inferentialMap", "collapsedTruth"],
} as const;

export function handoffInferentialToMetacognitive(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, INFERENTIAL_TO_METACOGNITIVE_CONTRACT);
  return state;
}
