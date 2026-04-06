import type {
  IntentGatePrimaryIntent,
  IntentGateResponseModeHint,
  ResponseModeHintResult,
} from "../intent-gate.types";

export function deriveResponseModeHint(input: {
  primaryIntent: IntentGatePrimaryIntent;
  hasValidationSignal: boolean;
  hasCorrectionSignal: boolean;
  hasComparisonSignal: boolean;
  hasActionRequest: boolean;
}): ResponseModeHintResult {
  const tags: string[] = [];
  let responseModeHint: IntentGateResponseModeHint = "contextual";

  if (input.primaryIntent === "pure_greeting" || input.primaryIntent === "react_socially") {
    responseModeHint = "social";
    tags.push("social_mode");
  } else if (input.primaryIntent === "ask_information") {
    responseModeHint = "factual";
    tags.push("factual_mode");
  } else if (input.primaryIntent === "ask_explanation" || input.primaryIntent === "request_guidance") {
    responseModeHint = "instructional";
    tags.push("instructional_mode");
  } else if (input.primaryIntent === "ask_comparison") {
    responseModeHint = "comparative";
    tags.push("comparative_mode");
  } else if (input.primaryIntent === "ask_execution") {
    responseModeHint = "conversational_technical";
    tags.push("conversational_technical_mode");
  } else if (input.primaryIntent === "continue_previous_reasoning") {
    responseModeHint = "reflective";
    tags.push("reflective_mode");
  }

  if (input.hasValidationSignal) {
    responseModeHint = "validation";
    tags.push("validation_override");
  } else if (input.hasCorrectionSignal) {
    responseModeHint = "corrective";
    tags.push("correction_override");
  } else if (input.hasComparisonSignal) {
    responseModeHint = "comparative";
    tags.push("comparison_override");
  } else if (input.hasActionRequest && responseModeHint === "contextual") {
    responseModeHint = "instructional";
    tags.push("action_override");
  }

  return {
    responseModeHint,
    reasoningTags: tags,
  };
}

