import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const CONVERSATION_TO_BEHAVIOR_CONTRACT = {
  from: "conversation",
  to: "behavior-personality",
  requiredFields: ["recentTurns", "activeContext", "inputSignals", "conversationState", "languageState"],
} as const;

export function handoffConversationToContext(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, CONVERSATION_TO_BEHAVIOR_CONTRACT);
  return state;
}
