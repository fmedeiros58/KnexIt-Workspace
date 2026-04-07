import type {
  IntentGateMinimalDepth,
  IntentGatePrimaryIntent,
  RoutingRecommendationResult,
} from "../intent-gate.types";

function needsDeepEscalation(minimalDepth: IntentGateMinimalDepth): boolean {
  return minimalDepth === "analytical" || minimalDepth === "deep";
}

export function deriveRoutingRecommendation(input: {
  primaryIntent: IntentGatePrimaryIntent;
  isPureGreeting: boolean;
  hasActionRequest: boolean;
  hasValidationSignal: boolean;
  hasCorrectionSignal: boolean;
  hasComparisonSignal: boolean;
  hasContextDependency: boolean;
  minimalDepth: IntentGateMinimalDepth;
  safetyAction: string;
}): RoutingRecommendationResult {
  const tags: string[] = [];
  const safetyAction = `${input.safetyAction || "allow"}`.trim().toLowerCase();

  if (safetyAction !== "allow") {
    return {
      routingRecommendation: "lightweight_answer",
      shouldBypassDeepPipeline: true,
      shouldEscalateToDeepPipeline: false,
      reasoningTags: ["safety_conservative_route"],
    };
  }

  if (input.isPureGreeting) {
    return {
      routingRecommendation: "direct_social_response",
      shouldBypassDeepPipeline: true,
      shouldEscalateToDeepPipeline: false,
      reasoningTags: ["pure_greeting_direct_route"],
    };
  }

  const isMicroSocialIntent =
    input.primaryIntent === "react_socially" ||
    input.primaryIntent === "acknowledge" ||
    input.primaryIntent === "conversational_check";
  const isMicroSocialSafe =
    isMicroSocialIntent &&
    !input.hasActionRequest &&
    !input.hasValidationSignal &&
    !input.hasCorrectionSignal &&
    !input.hasComparisonSignal &&
    !input.hasContextDependency &&
    (input.minimalDepth === "zero" || input.minimalDepth === "minimal");

  if (isMicroSocialSafe) {
    return {
      routingRecommendation: "lightweight_answer",
      shouldBypassDeepPipeline: true,
      shouldEscalateToDeepPipeline: false,
      reasoningTags: ["pure_micro_social_lightweight_route"],
    };
  }

  const highDepth = needsDeepEscalation(input.minimalDepth);
  if (input.hasValidationSignal) tags.push("deep_default_validation");
  if (input.hasCorrectionSignal) tags.push("deep_default_correction");
  if (input.hasComparisonSignal) tags.push("deep_default_comparison");
  if (input.hasActionRequest) tags.push("deep_default_action_request");
  if (input.hasContextDependency) tags.push("deep_default_context_dependency");
  tags.push(highDepth ? "deep_default_high_depth" : "deep_default_non_microturn");
  return {
    routingRecommendation: "deep_pipeline_required",
    shouldBypassDeepPipeline: false,
    shouldEscalateToDeepPipeline: true,
    reasoningTags: tags,
  };
}
