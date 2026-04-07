import type { GreetingFamilyId } from "../../shared/utils/conversation-signals";

export interface GreetingFastLaneInput {
  text: string;
  quickIntent: string;
  quickComplexity: number;
  quickAmbiguity: number;
  tokenCount: number;
  questionCount: number;
  safetyAction: string;
}

export interface GreetingFastLaneDecision {
  detected: boolean;
  family: GreetingFamilyId | null;
  confidence: number;
  canonicalText: string;
  eligible: boolean;
  reason:
    | "eligible"
    | "no_greeting_family"
    | "safety_blocked"
    | "intent_not_chat_like"
    | "token_limit_exceeded"
    | "question_limit_exceeded"
    | "complexity_limit_exceeded"
    | "ambiguity_limit_exceeded";
}

