/** ai-system-anm */

export type ResponseIntent =
  | "direct"
  | "explanatory"
  | "comparative"
  | "stepwise"
  | "clarifying";

export type DepthLevel = "shallow" | "standard" | "deep";

export interface RegulateDepthInput {
  complexityScore: number;
  responseIntent: ResponseIntent;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function regulateDepth(input: RegulateDepthInput): DepthLevel {
  const complexityScore = clamp01(input.complexityScore);

  if (input.responseIntent === "direct") {
    if (complexityScore < 0.34) return "shallow";
    if (complexityScore >= 0.72) return "deep";
    return "standard";
  }

  if (input.responseIntent === "clarifying") {
    if (complexityScore < 0.48) return "shallow";
    if (complexityScore >= 0.76) return "deep";
    return "standard";
  }

  if (input.responseIntent === "comparative") {
    if (complexityScore >= 0.58) return "deep";
    return "standard";
  }

  if (input.responseIntent === "stepwise") {
    if (complexityScore >= 0.56) return "deep";
    return "standard";
  }

  if (input.responseIntent === "explanatory") {
    if (complexityScore >= 0.6) return "deep";
    return "standard";
  }

  if (complexityScore >= 0.75) return "deep";
  if (complexityScore < 0.35) return "shallow";
  return "standard";
}