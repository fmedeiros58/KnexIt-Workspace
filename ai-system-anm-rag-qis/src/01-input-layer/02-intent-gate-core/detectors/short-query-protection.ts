import type {
  IntentGateMinimalDepth,
  IntentGatePrimaryIntent,
  ShortQueryProtectionResult,
} from "../intent-gate.types";

function maxDepth(a: IntentGateMinimalDepth, b: IntentGateMinimalDepth): IntentGateMinimalDepth {
  const rank = (value: IntentGateMinimalDepth): number => {
    if (value === "zero") return 0;
    if (value === "minimal") return 1;
    if (value === "contextual") return 2;
    if (value === "analytical") return 3;
    return 4;
  };
  return rank(a) >= rank(b) ? a : b;
}

function hasStrongShortDensePattern(text: string): boolean {
  return /\b(isso esta certo|isso ta certo|seria aqui|e nesse caso|faz sentido|qual fica melhor|mas ai nao quebra|entao eu adiciono onde|nao seria no outro arquivo|quem e [a-z0-9_-]{2,}|o que e [a-z0-9_-]{2,}|qual e [a-z0-9_-]{2,})\b/i.test(
    text,
  );
}

export function runShortQueryProtection(input: {
  text: string;
  tokenCount: number;
  questionCount: number;
  primaryIntent: IntentGatePrimaryIntent;
  hasContextDependency: boolean;
  contextDependencyScore: number;
  ambiguityScore: number;
  semanticDensityScore: number;
  minimalDepth: IntentGateMinimalDepth;
  hasValidationSignal: boolean;
  hasComparisonSignal: boolean;
}): ShortQueryProtectionResult {
  const tags: string[] = [];
  const shortMessage = input.tokenCount <= 7;
  const shortQuestion = shortMessage && input.questionCount > 0;
  const denseShort =
    shortMessage &&
    (input.semanticDensityScore >= 0.46 ||
      input.ambiguityScore >= 0.50 ||
      input.contextDependencyScore >= 0.46);
  const strongPattern = hasStrongShortDensePattern(input.text);

  if (!shortMessage) {
    return {
      triggered: false,
      forcedMinimalDepth: input.minimalDepth,
      forcedContextUsage: false,
      reasoningTags: ["short_query_protection_not_short"],
    };
  }

  if (
    input.primaryIntent === "pure_greeting" ||
    input.primaryIntent === "react_socially" ||
    input.primaryIntent === "acknowledge"
  ) {
    return {
      triggered: false,
      forcedMinimalDepth: input.minimalDepth,
      forcedContextUsage: false,
      reasoningTags: ["short_query_protection_social_short"],
    };
  }

  const shouldTrigger =
    shortQuestion ||
    denseShort ||
    strongPattern ||
    input.hasValidationSignal ||
    input.hasComparisonSignal ||
    input.hasContextDependency;

  if (!shouldTrigger) {
    return {
      triggered: false,
      forcedMinimalDepth: input.minimalDepth,
      forcedContextUsage: false,
      reasoningTags: ["short_query_protection_not_triggered"],
    };
  }

  tags.push("short_query_protection_triggered");
  if (shortQuestion) tags.push("short_question");
  if (denseShort) tags.push("dense_short_query");
  if (strongPattern) tags.push("strong_dense_pattern");
  if (input.hasValidationSignal) tags.push("validation_signal");
  if (input.hasComparisonSignal) tags.push("comparison_signal");
  if (input.hasContextDependency) tags.push("context_dependency_signal");

  let forcedMinimalDepth = maxDepth(input.minimalDepth, "contextual");
  if (input.hasComparisonSignal && input.ambiguityScore >= 0.52) {
    forcedMinimalDepth = maxDepth(forcedMinimalDepth, "analytical");
  }

  return {
    triggered: true,
    forcedMinimalDepth,
    forcedContextUsage: input.hasContextDependency || input.contextDependencyScore >= 0.40,
    reasoningTags: tags,
  };
}
