import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { PipelineRoute } from "../shared/enums/pipeline-enums";

function hasVerifiableSignal(text: string) {
  return /\b(quem|qual|which|what|when|where|who|atual|latest|hoje|today|fonte|source|cite)\b/i.test(text);
}

export function routeRequest(state: ProcessingState): PipelineRoute {
  const score = state.complexityProfile.score;
  const ambiguity = state.complexityProfile.ambiguity;
  const text = state.normalizedMessage;

  if (hasVerifiableSignal(text) || state.inputSignals.intent === "research") return "quantum-state";
  if (score >= 0.58 || ambiguity >= 0.52 || state.inputSignals.intent === "analysis") return "inferential";
  if (score >= 0.42 || ambiguity >= 0.34 || state.inputSignals.intent === "technical") return "reflective";
  return "minimum";
}
