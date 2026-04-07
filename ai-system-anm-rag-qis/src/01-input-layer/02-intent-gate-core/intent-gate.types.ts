import type { TextAnalysisSnapshot } from "../../shared/text-processing/text-analysis-snapshot";
import type { GreetingFastLaneDecision } from "../03-greeting-fast-lane-core/greeting-fast-lane-types";

export type IntentGatePrimaryIntent =
  | "pure_greeting"
  | "greeting_with_request"
  | "ask_information"
  | "ask_explanation"
  | "ask_validation"
  | "ask_correction"
  | "ask_comparison"
  | "ask_execution"
  | "ask_refinement"
  | "continue_previous_reasoning"
  | "react_socially"
  | "acknowledge"
  | "challenge"
  | "request_help"
  | "request_guidance"
  | "conversational_check"
  | "ambiguous_short_query";

export type IntentGateMinimalDepth = "zero" | "minimal" | "contextual" | "analytical" | "deep";

export type IntentGateRoutingRecommendation =
  | "direct_social_response"
  | "lightweight_answer"
  | "short_contextual_response"
  | "short_validation_response"
  | "short_instructional_response"
  | "moderate_reasoning"
  | "deep_pipeline_required";

export type IntentGateResponseModeHint =
  | "social"
  | "factual"
  | "contextual"
  | "validation"
  | "corrective"
  | "instructional"
  | "reflective"
  | "comparative"
  | "conversational_technical";

export interface IntentGateInput {
  text: string;
  snapshot: TextAnalysisSnapshot;
  quickIntent: string;
  quickComplexity: number;
  quickAmbiguity: number;
  safetyAction: string;
  greeting?: GreetingFastLaneDecision;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface PrimaryIntentDetection {
  primaryIntent: IntentGatePrimaryIntent;
  secondaryIntents: IntentGatePrimaryIntent[];
  hasActionRequest: boolean;
  hasValidationSignal: boolean;
  hasCorrectionSignal: boolean;
  hasComparisonSignal: boolean;
  hasGreeting: boolean;
  hasGreetingButNotPure: boolean;
  reasoningTags: string[];
}

export interface ContextDependencyDetection {
  hasContextDependency: boolean;
  contextDependencyScore: number;
  reasoningTags: string[];
}

export interface MinimalDepthEstimation {
  minimalDepth: IntentGateMinimalDepth;
  reasoningTags: string[];
}

export interface ShortQueryProtectionResult {
  triggered: boolean;
  forcedMinimalDepth: IntentGateMinimalDepth;
  forcedContextUsage: boolean;
  reasoningTags: string[];
}

export interface RoutingRecommendationResult {
  routingRecommendation: IntentGateRoutingRecommendation;
  shouldBypassDeepPipeline: boolean;
  shouldEscalateToDeepPipeline: boolean;
  reasoningTags: string[];
}

export interface ResponseModeHintResult {
  responseModeHint: IntentGateResponseModeHint;
  reasoningTags: string[];
}

export interface IntentGateResult {
  greetingDecision: GreetingFastLaneDecision;
  primaryIntent: IntentGatePrimaryIntent;
  secondaryIntents: IntentGatePrimaryIntent[];
  isPureGreeting: boolean;
  hasGreeting: boolean;
  hasActionRequest: boolean;
  hasValidationSignal: boolean;
  hasCorrectionSignal: boolean;
  hasComparisonSignal: boolean;
  hasContextDependency: boolean;
  contextDependencyScore: number;
  ambiguityScore: number;
  semanticDensityScore: number;
  minimalDepth: IntentGateMinimalDepth;
  routingRecommendation: IntentGateRoutingRecommendation;
  responseModeHint: IntentGateResponseModeHint;
  shouldBypassDeepPipeline: boolean;
  shouldUseRecentConversationContext: boolean;
  shouldEscalateToDeepPipeline: boolean;
  confidence: number;
  reasoningTags: string[];
  debugTrace: string[];
}
