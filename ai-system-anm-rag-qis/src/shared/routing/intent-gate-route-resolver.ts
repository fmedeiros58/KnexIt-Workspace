import type { PipelineRoute } from "../enums/pipeline-enums";

export interface IntentGateRouteInput {
  routingRecommendation?: string;
  shouldEscalateToDeepPipeline?: boolean;
  hasVerifiableSignal?: boolean;
}

export interface IntentGateEvaluationInput {
  intentGateConfidence?: number;
  intentGateDebugTrace?: string[];
}

export function hasIntentGateEvaluation(input: IntentGateEvaluationInput): boolean {
  return (input.intentGateConfidence || 0) > 0 || Boolean(input.intentGateDebugTrace?.length);
}

function deepRoute(hasVerifiableSignal?: boolean): PipelineRoute {
  void hasVerifiableSignal;
  return "inferential";
}

export function resolveIntentGateRoute(input: IntentGateRouteInput): PipelineRoute | null {
  const recommendation = `${input.routingRecommendation || ""}`.trim().toLowerCase();
  if (!recommendation) return null;

  if (recommendation === "direct_social_response") return "minimum";
  if (recommendation === "lightweight_answer") return "minimum";
  if (recommendation === "short_contextual_response") return deepRoute(input.hasVerifiableSignal);
  if (recommendation === "short_validation_response") return deepRoute(input.hasVerifiableSignal);
  if (recommendation === "short_instructional_response") return deepRoute(input.hasVerifiableSignal);
  if (recommendation === "moderate_reasoning") return deepRoute(input.hasVerifiableSignal);
  if (recommendation === "deep_pipeline_required") return deepRoute(input.hasVerifiableSignal);
  if (input.shouldEscalateToDeepPipeline) return deepRoute(input.hasVerifiableSignal);
  return null;
}
