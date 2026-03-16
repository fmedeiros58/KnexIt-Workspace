import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const MEMORY_TO_KNOWLEDGE_CONTRACT = {
  from: "memory",
  to: "knowledge",
  requiredFields: ["memorySnapshot"],
} as const;

export function handoffMemoryToKnowledge(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, MEMORY_TO_KNOWLEDGE_CONTRACT);
  return state;
}
