import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const CONTEXT_TO_ORCHESTRATION_CONTRACT = {
  from: "context",
  to: "orchestration",
  requiredFields: ["activeContext", "activeConstraints", "selectedMode"],
} as const;

export function handoffContextToOrchestration(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, CONTEXT_TO_ORCHESTRATION_CONTRACT);
  return state;
}
