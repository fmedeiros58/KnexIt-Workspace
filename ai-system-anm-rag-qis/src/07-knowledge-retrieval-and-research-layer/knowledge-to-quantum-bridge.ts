import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const KNOWLEDGE_TO_QUANTUM_CONTRACT = {
  from: "knowledge",
  to: "quantum",
  requiredFields: ["retrievedSources", "retrievedEvidence"],
} as const;

export function handoffKnowledgeToQuantum(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, KNOWLEDGE_TO_QUANTUM_CONTRACT);
  return state;
}
