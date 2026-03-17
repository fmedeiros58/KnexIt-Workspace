import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const ORCHESTRATION_TO_MEMORY_CONTRACT = {
  from: "orchestration",
  to: "memory",
  requiredFields: ["complexityProfile", "executionPlan"],
} as const;

export function handoffOrchestrationToMemory(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, ORCHESTRATION_TO_MEMORY_CONTRACT);
  return state;
}
