import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const INPUT_TO_CONTEXT_CONTRACT = {
  from: "input",
  to: "context",
  requiredFields: ["normalizedMessage", "inputSignals", "sessionState"],
} as const;

export function handoffInputToContext(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, INPUT_TO_CONTEXT_CONTRACT);
  return state;
}
