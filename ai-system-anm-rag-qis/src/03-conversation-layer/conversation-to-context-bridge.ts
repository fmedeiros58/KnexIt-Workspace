import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const CONVERSATION_TO_CONTEXT_CONTRACT = {
  from: "conversation",
  to: "context",
  requiredFields: ["recentTurns", "activeContext", "inputSignals"],
} as const;

export function handoffConversationToContext(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, CONVERSATION_TO_CONTEXT_CONTRACT);
  return state;
}
