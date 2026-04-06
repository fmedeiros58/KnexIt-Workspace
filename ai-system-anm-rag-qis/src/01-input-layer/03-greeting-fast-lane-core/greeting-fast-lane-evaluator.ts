import { resolveGreetingFamily } from "../../shared/utils/conversation-signals";
import { GREETING_FAST_LANE_POLICY } from "./greeting-fast-lane-policy";
import type { GreetingFastLaneDecision, GreetingFastLaneInput } from "./greeting-fast-lane-types";

function isChatLikeIntent(value: string): boolean {
  const normalized = `${value || ""}`.trim().toLowerCase();
  return normalized === "" || normalized === "chat" || normalized === "unknown";
}

export function evaluateGreetingFastLane(input: GreetingFastLaneInput): GreetingFastLaneDecision {
  const detection = resolveGreetingFamily(input.text);

  if (!detection.detected || !detection.family) {
    return {
      detected: false,
      family: null,
      confidence: 0,
      canonicalText: detection.canonicalText,
      eligible: false,
      reason: "no_greeting_family",
    };
  }

  if (`${input.safetyAction || "allow"}`.trim().toLowerCase() !== "allow") {
    return {
      detected: true,
      family: detection.family,
      confidence: detection.confidence,
      canonicalText: detection.canonicalText,
      eligible: false,
      reason: "safety_blocked",
    };
  }

  if (!isChatLikeIntent(input.quickIntent)) {
    return {
      detected: true,
      family: detection.family,
      confidence: detection.confidence,
      canonicalText: detection.canonicalText,
      eligible: false,
      reason: "intent_not_chat_like",
    };
  }

  if (input.tokenCount > GREETING_FAST_LANE_POLICY.maxTokenCount) {
    return {
      detected: true,
      family: detection.family,
      confidence: detection.confidence,
      canonicalText: detection.canonicalText,
      eligible: false,
      reason: "token_limit_exceeded",
    };
  }

  if (input.questionCount > GREETING_FAST_LANE_POLICY.maxQuestionCount) {
    return {
      detected: true,
      family: detection.family,
      confidence: detection.confidence,
      canonicalText: detection.canonicalText,
      eligible: false,
      reason: "question_limit_exceeded",
    };
  }

  if (input.quickComplexity > GREETING_FAST_LANE_POLICY.maxQuickComplexity) {
    return {
      detected: true,
      family: detection.family,
      confidence: detection.confidence,
      canonicalText: detection.canonicalText,
      eligible: false,
      reason: "complexity_limit_exceeded",
    };
  }

  if (input.quickAmbiguity > GREETING_FAST_LANE_POLICY.maxQuickAmbiguity) {
    return {
      detected: true,
      family: detection.family,
      confidence: detection.confidence,
      canonicalText: detection.canonicalText,
      eligible: false,
      reason: "ambiguity_limit_exceeded",
    };
  }

  return {
    detected: true,
    family: detection.family,
    confidence: detection.confidence,
    canonicalText: detection.canonicalText,
    eligible: true,
    reason: "eligible",
  };
}

