import type {
  IntentGateMinimalDepth,
  IntentGatePrimaryIntent,
  MinimalDepthEstimation,
} from "../intent-gate.types";

function scoreDepthValue(level: IntentGateMinimalDepth): number {
  if (level === "zero") return 0;
  if (level === "minimal") return 1;
  if (level === "contextual") return 2;
  if (level === "analytical") return 3;
  return 4;
}

function maxDepth(a: IntentGateMinimalDepth, b: IntentGateMinimalDepth): IntentGateMinimalDepth {
  return scoreDepthValue(a) >= scoreDepthValue(b) ? a : b;
}

export function estimateMinimalDepth(input: {
  primaryIntent: IntentGatePrimaryIntent;
  tokenCount: number;
  contextDependencyScore: number;
  ambiguityScore: number;
  semanticDensityScore: number;
  hasValidationSignal: boolean;
  hasCorrectionSignal: boolean;
  hasComparisonSignal: boolean;
  hasActionRequest: boolean;
}): MinimalDepthEstimation {
  const tags: string[] = [];
  const {
    primaryIntent,
    tokenCount,
    contextDependencyScore,
    ambiguityScore,
    semanticDensityScore,
    hasValidationSignal,
    hasCorrectionSignal,
    hasComparisonSignal,
    hasActionRequest,
  } = input;

  if (primaryIntent === "pure_greeting") {
    return {
      minimalDepth: "zero",
      reasoningTags: ["pure_greeting_zero_depth"],
    };
  }

  if (
    primaryIntent === "react_socially" ||
    primaryIntent === "acknowledge" ||
    primaryIntent === "conversational_check"
  ) {
    return {
      minimalDepth: "minimal",
      reasoningTags: ["social_or_acknowledgement_minimal_depth"],
    };
  }

  const weightedScore =
    semanticDensityScore * 0.44 + ambiguityScore * 0.24 + contextDependencyScore * 0.32;

  let minimalDepth: IntentGateMinimalDepth;
  if (weightedScore >= 0.82) {
    minimalDepth = "deep";
  } else if (weightedScore >= 0.58) {
    minimalDepth = "analytical";
  } else if (weightedScore >= 0.34) {
    minimalDepth = "contextual";
  } else {
    minimalDepth = "minimal";
  }

  if (hasComparisonSignal) {
    tags.push("comparison_requires_more_depth");
    minimalDepth = maxDepth(minimalDepth, ambiguityScore >= 0.50 ? "analytical" : "contextual");
  }

  if (hasValidationSignal) {
    tags.push("validation_requires_contextual_floor");
    minimalDepth = maxDepth(minimalDepth, "contextual");
  }

  if (hasCorrectionSignal) {
    tags.push("correction_requires_contextual_floor");
    minimalDepth = maxDepth(minimalDepth, "contextual");
  }

  if (hasActionRequest && tokenCount <= 8) {
    tags.push("short_action_request_contextual_floor");
    minimalDepth = maxDepth(minimalDepth, "contextual");
  }

  if (tokenCount <= 6 && (contextDependencyScore >= 0.45 || ambiguityScore >= 0.46)) {
    tags.push("short_message_not_trivial");
    minimalDepth = maxDepth(minimalDepth, "contextual");
  }

  if (
    primaryIntent === "continue_previous_reasoning" ||
    primaryIntent === "ambiguous_short_query"
  ) {
    tags.push("continuation_or_ambiguous_short_query");
    minimalDepth = maxDepth(minimalDepth, "contextual");
  }

  tags.push(`depth_score:${weightedScore.toFixed(2)}`);
  tags.push(`depth_selected:${minimalDepth}`);

  return {
    minimalDepth,
    reasoningTags: tags,
  };
}

