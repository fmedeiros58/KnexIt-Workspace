import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const INPUT_TO_LANGUAGE_CONTRACT = {
  from: "input",
  to: "language",
  requiredFields: ["normalizedMessage", "inputSignals", "sessionState"],
} as const;

export function handoffInputToLanguage(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, INPUT_TO_LANGUAGE_CONTRACT);
  return state;
}
