import { pragmaticAggregationEngine } from "../../../02-language-layer/pragmatic-language-core/pragmatic-aggregation-engine";
import type { IntentGatePrimaryIntent, PrimaryIntentDetection } from "../intent-gate.types";
import { PRIMARY_INTENT_PATTERNS } from "../utils/intent-patterns";
import {
  hasActionRequestMarker,
  hasComparisonMarker,
  hasCorrectionMarker,
  hasValidationMarker,
} from "../utils/contextual-markers";

function normalize(value: string): string {
  return `${value || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function detectByPattern(text: string): IntentGatePrimaryIntent | null {
  for (const family of PRIMARY_INTENT_PATTERNS) {
    if (family.patterns.some((pattern) => pattern.test(text))) return family.intent;
  }
  return null;
}

function mapPragmaticIntent(
  pragmaticIntent: string,
  speechAct: string,
): IntentGatePrimaryIntent {
  if (pragmaticIntent === "execute_change") return "ask_execution";
  if (pragmaticIntent === "seek_alignment") return "ask_validation";
  if (pragmaticIntent === "ask_clarification") return "request_guidance";
  if (pragmaticIntent === "challenge") return "challenge";
  if (pragmaticIntent === "social_contact") {
    if (speechAct === "greeting") return "pure_greeting";
    return "react_socially";
  }
  if (pragmaticIntent === "ask_information") return "ask_information";
  return "ambiguous_short_query";
}

export function detectPrimaryIntent(input: {
  text: string;
  hasGreeting: boolean;
  greetingEligible: boolean;
}): PrimaryIntentDetection {
  const text = normalize(input.text);
  const pragmatic = pragmaticAggregationEngine({ text });
  const byPattern = detectByPattern(text);

  const hasValidationSignal = hasValidationMarker(text);
  const hasCorrectionSignal = hasCorrectionMarker(text);
  const hasComparisonSignal = hasComparisonMarker(text);
  const hasActionRequest = hasActionRequestMarker(text) || pragmatic.directiveForce >= 0.58;

  let primaryIntent: IntentGatePrimaryIntent =
    byPattern || mapPragmaticIntent(pragmatic.intent, pragmatic.speechAct);

  const secondaryIntents: IntentGatePrimaryIntent[] = [];
  if (hasValidationSignal && primaryIntent !== "ask_validation") secondaryIntents.push("ask_validation");
  if (hasCorrectionSignal && primaryIntent !== "ask_correction") secondaryIntents.push("ask_correction");
  if (hasComparisonSignal && primaryIntent !== "ask_comparison") secondaryIntents.push("ask_comparison");
  if (hasActionRequest && primaryIntent !== "ask_execution") secondaryIntents.push("ask_execution");

  if (input.hasGreeting && hasActionRequest) {
    primaryIntent = "greeting_with_request";
  } else if (input.hasGreeting && input.greetingEligible && !hasActionRequest) {
    primaryIntent = "pure_greeting";
  } else if (input.hasGreeting && !input.greetingEligible && primaryIntent === "pure_greeting") {
    primaryIntent = "react_socially";
  }

  const hasGreetingButNotPure = input.hasGreeting && primaryIntent !== "pure_greeting";
  const reasoningTags: string[] = [
    `speech_act:${pragmatic.speechAct}`,
    `pragmatic_intent:${pragmatic.intent}`,
    `directive_force:${pragmatic.directiveForce.toFixed(2)}`,
    ...(input.hasGreeting ? ["greeting_detected"] : []),
    ...(hasGreetingButNotPure ? ["greeting_plus_payload"] : []),
    ...(hasActionRequest ? ["action_request_signal"] : []),
    ...(hasValidationSignal ? ["validation_signal"] : []),
    ...(hasCorrectionSignal ? ["correction_signal"] : []),
    ...(hasComparisonSignal ? ["comparison_signal"] : []),
  ];

  return {
    primaryIntent,
    secondaryIntents: [...new Set(secondaryIntents)],
    hasActionRequest,
    hasValidationSignal,
    hasCorrectionSignal,
    hasComparisonSignal,
    hasGreeting: input.hasGreeting,
    hasGreetingButNotPure,
    reasoningTags,
  };
}
