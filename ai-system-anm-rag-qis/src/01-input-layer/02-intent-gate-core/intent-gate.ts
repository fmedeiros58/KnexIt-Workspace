import { detectContextDependency } from "./detectors/context-dependency-detector";
import { estimateMinimalDepth } from "./detectors/minimal-depth-estimator";
import { detectPrimaryIntent } from "./detectors/primary-intent-detector";
import { deriveResponseModeHint } from "./detectors/response-mode-hint-engine";
import { deriveRoutingRecommendation } from "./detectors/routing-recommendation-engine";
import { runShortQueryProtection } from "./detectors/short-query-protection";
import { evaluateGreetingFastLane } from "../03-greeting-fast-lane-core/greeting-fast-lane-bridge";
import type { GreetingFastLaneDecision } from "../03-greeting-fast-lane-core/greeting-fast-lane-types";
import type {
  IntentGateInput,
  IntentGatePrimaryIntent,
  IntentGateResult,
} from "./intent-gate.types";
import { estimateIntentGateAmbiguity } from "./utils/ambiguity-signals";
import { estimateSemanticDensity } from "./utils/semantic-density";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function hasGreetingPrefix(text: string): boolean {
  return /^(oi+|oie+|ola+|opa+|fala+|salve+|bom dia|boa tarde|boa noite|saudacoes)\b/i.test(
    `${text || ""}`.trim(),
  );
}

function resolveGreetingDecision(input: IntentGateInput, text: string): GreetingFastLaneDecision {
  if (input.greeting) return input.greeting;
  return evaluateGreetingFastLane({
    text,
    quickIntent: input.quickIntent,
    quickComplexity: input.quickComplexity,
    quickAmbiguity: input.quickAmbiguity,
    tokenCount: input.snapshot.tokenCount,
    questionCount: input.snapshot.questionCount,
    safetyAction: input.safetyAction,
  });
}

function detectContinuationPrimaryIntent(
  current: IntentGatePrimaryIntent,
  hasContextDependency: boolean,
  tokenCount: number,
): IntentGatePrimaryIntent {
  if (
    current === "ask_information" &&
    hasContextDependency &&
    tokenCount <= 7
  ) {
    return "continue_previous_reasoning";
  }
  if (current === "ambiguous_short_query" && hasContextDependency) {
    return "continue_previous_reasoning";
  }
  return current;
}

export function runIntentGate(input: IntentGateInput): IntentGateResult {
  const text = `${input.text || ""}`.trim();
  const normalized = text.toLowerCase();
  const greetingDecision = resolveGreetingDecision(input, text);
  const hasGreetingSignal =
    greetingDecision.detected || input.snapshot.hasGreetingSignal || hasGreetingPrefix(text);

  const primaryIntentDetection = detectPrimaryIntent({
    text: normalized,
    hasGreeting: hasGreetingSignal,
    greetingEligible: greetingDecision.eligible,
  });

  const contextDependency = detectContextDependency({
    text: normalized,
    tokenCount: input.snapshot.tokenCount,
    questionCount: input.snapshot.questionCount,
    recentTurns: input.recentTurns,
    hasGreeting: hasGreetingSignal,
  });

  const ambiguity = estimateIntentGateAmbiguity({
    text: normalized,
    snapshot: input.snapshot,
    contextDependencyScore: contextDependency.contextDependencyScore,
  });

  const semanticDensity = estimateSemanticDensity({
    snapshot: input.snapshot,
    hasValidationSignal: primaryIntentDetection.hasValidationSignal,
    hasComparisonSignal: primaryIntentDetection.hasComparisonSignal,
    hasCorrectionSignal: primaryIntentDetection.hasCorrectionSignal,
    hasActionRequest: primaryIntentDetection.hasActionRequest,
    contextDependencyScore: contextDependency.contextDependencyScore,
  });

  let primaryIntent = detectContinuationPrimaryIntent(
    primaryIntentDetection.primaryIntent,
    contextDependency.hasContextDependency,
    input.snapshot.tokenCount,
  );

  const minimalDepth = estimateMinimalDepth({
    primaryIntent,
    tokenCount: input.snapshot.tokenCount,
    contextDependencyScore: contextDependency.contextDependencyScore,
    ambiguityScore: ambiguity.score,
    semanticDensityScore: semanticDensity.score,
    hasValidationSignal: primaryIntentDetection.hasValidationSignal,
    hasCorrectionSignal: primaryIntentDetection.hasCorrectionSignal,
    hasComparisonSignal: primaryIntentDetection.hasComparisonSignal,
    hasActionRequest: primaryIntentDetection.hasActionRequest,
  });

  const shortQueryProtection = runShortQueryProtection({
    text: normalized,
    tokenCount: input.snapshot.tokenCount,
    questionCount: input.snapshot.questionCount,
    primaryIntent,
    hasContextDependency: contextDependency.hasContextDependency,
    contextDependencyScore: contextDependency.contextDependencyScore,
    ambiguityScore: ambiguity.score,
    semanticDensityScore: semanticDensity.score,
    minimalDepth: minimalDepth.minimalDepth,
    hasValidationSignal: primaryIntentDetection.hasValidationSignal,
    hasComparisonSignal: primaryIntentDetection.hasComparisonSignal,
  });

  const forcedMinimalDepth = shortQueryProtection.triggered
    ? shortQueryProtection.forcedMinimalDepth
    : minimalDepth.minimalDepth;

  const isPureGreeting = primaryIntent === "pure_greeting" && !primaryIntentDetection.hasActionRequest;

  const routing = deriveRoutingRecommendation({
    primaryIntent,
    isPureGreeting,
    hasActionRequest: primaryIntentDetection.hasActionRequest,
    hasValidationSignal: primaryIntentDetection.hasValidationSignal,
    hasCorrectionSignal: primaryIntentDetection.hasCorrectionSignal,
    hasComparisonSignal: primaryIntentDetection.hasComparisonSignal,
    hasContextDependency: contextDependency.hasContextDependency,
    minimalDepth: forcedMinimalDepth,
    safetyAction: input.safetyAction,
  });

  const responseMode = deriveResponseModeHint({
    primaryIntent,
    hasValidationSignal: primaryIntentDetection.hasValidationSignal,
    hasCorrectionSignal: primaryIntentDetection.hasCorrectionSignal,
    hasComparisonSignal: primaryIntentDetection.hasComparisonSignal,
    hasActionRequest: primaryIntentDetection.hasActionRequest,
  });

  const confidence = clamp01(
    0.42 +
      (primaryIntentDetection.reasoningTags.length > 0 ? 0.16 : 0) +
      contextDependency.contextDependencyScore * 0.12 +
      semanticDensity.score * 0.14 +
      (shortQueryProtection.triggered ? 0.08 : 0) -
      ambiguity.score * 0.07,
  );

  const reasoningTags = dedupe([
    ...primaryIntentDetection.reasoningTags,
    ...contextDependency.reasoningTags,
    ...ambiguity.tags,
    ...semanticDensity.tags,
    ...minimalDepth.reasoningTags,
    ...shortQueryProtection.reasoningTags,
    ...routing.reasoningTags,
    ...responseMode.reasoningTags,
  ]);

  const secondaryIntents = dedupe([
    ...primaryIntentDetection.secondaryIntents,
    ...(primaryIntent !== primaryIntentDetection.primaryIntent ? [primaryIntentDetection.primaryIntent] : []),
  ]) as IntentGatePrimaryIntent[];

  const shouldUseRecentConversationContext =
    contextDependency.hasContextDependency || shortQueryProtection.forcedContextUsage;

  const debugTrace = [
    `intent_gate.primary=${primaryIntent}`,
    `intent_gate.secondary=${secondaryIntents.join(",") || "none"}`,
    `intent_gate.context_dependency=${contextDependency.contextDependencyScore.toFixed(2)}`,
    `intent_gate.ambiguity=${ambiguity.score.toFixed(2)}`,
    `intent_gate.semantic_density=${semanticDensity.score.toFixed(2)}`,
    `intent_gate.minimal_depth=${forcedMinimalDepth}`,
    `intent_gate.route=${routing.routingRecommendation}`,
    `intent_gate.bypass_deep=${routing.shouldBypassDeepPipeline}`,
    `intent_gate.escalate_deep=${routing.shouldEscalateToDeepPipeline}`,
    `intent_gate.mode=${responseMode.responseModeHint}`,
  ];

  return {
    greetingDecision,
    primaryIntent,
    secondaryIntents,
    isPureGreeting,
    hasGreeting: hasGreetingSignal,
    hasActionRequest: primaryIntentDetection.hasActionRequest,
    hasValidationSignal: primaryIntentDetection.hasValidationSignal,
    hasCorrectionSignal: primaryIntentDetection.hasCorrectionSignal,
    hasComparisonSignal: primaryIntentDetection.hasComparisonSignal,
    hasContextDependency: contextDependency.hasContextDependency,
    contextDependencyScore: contextDependency.contextDependencyScore,
    ambiguityScore: ambiguity.score,
    semanticDensityScore: semanticDensity.score,
    minimalDepth: forcedMinimalDepth,
    routingRecommendation: routing.routingRecommendation,
    responseModeHint: responseMode.responseModeHint,
    shouldBypassDeepPipeline: routing.shouldBypassDeepPipeline,
    shouldUseRecentConversationContext,
    shouldEscalateToDeepPipeline: routing.shouldEscalateToDeepPipeline,
    confidence,
    reasoningTags,
    debugTrace,
  };
}
