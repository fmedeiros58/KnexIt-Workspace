import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { PipelineRoute } from "../shared/enums/pipeline-enums";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function isVerifiableQuestion(text: string) {
  const normalized = text.toLowerCase();
  return /\b(quem|qual|which|what|when|where|who|presidente|governador|prefeito|atual|latest|hoje|today)\b/.test(normalized);
}

function estimateLexicalComplexity(text: string) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;

  const longTokenRatio = tokens.filter((token) => token.length >= 8).length / tokens.length;
  const connectiveCount = (text.match(/\b(porque|portanto|contudo|however|therefore|since|although|se|entao|then|if)\b/gi) || []).length;
  const punctuationSignals = (text.match(/[;:()]/g) || []).length;
  const questionSignals = (text.match(/\?/g) || []).length;

  const tokenFactor = clamp01(tokens.length / 42);
  const connectiveFactor = clamp01(connectiveCount / 5);
  const punctuationFactor = clamp01(punctuationSignals / 6);
  const longTokenFactor = clamp01(longTokenRatio * 1.6);
  const questionFactor = questionSignals > 1 ? 0.08 : 0;

  return clamp01((tokenFactor * 0.45) + (connectiveFactor * 0.2) + (punctuationFactor * 0.15) + (longTokenFactor * 0.2) + questionFactor);
}

function estimateAmbiguity(text: string) {
  const ambiguousTerms = (text.match(/\b(ou|or|talvez|maybe|depende|it depends|pode ser|possibly|aprox|around|algum|some)\b/gi) || []).length;
  const pronouns = (text.match(/\b(isso|isto|that|this|it|aquilo)\b/gi) || []).length;
  const shortMessagePenalty = text.split(/\s+/).filter(Boolean).length < 5 ? 0.12 : 0;
  return clamp01((ambiguousTerms * 0.16) + (pronouns * 0.06) + shortMessagePenalty);
}

export function selectPipelineRoute(state: ProcessingState): PipelineRoute {
  const message = state.normalizedMessage || state.rawMessage;
  const lexicalScore = estimateLexicalComplexity(message);
  const ambiguity = estimateAmbiguity(message);
  const score = Math.max(state.complexityProfile.score, lexicalScore);

  state.complexityProfile.score = score;
  state.complexityProfile.ambiguity = Math.max(state.complexityProfile.ambiguity, ambiguity);

  if (isVerifiableQuestion(message) || score >= 0.72) return "quantum-state";
  if (score >= 0.55 || ambiguity >= 0.52) return "inferential";
  if (score >= 0.4 || ambiguity >= 0.34) return "reflective";
  return "minimum";
}
