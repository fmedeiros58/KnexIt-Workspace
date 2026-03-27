/** ai-system-anm */
export function regulateDepth(input: {
  complexityScore: number;
  responseIntent: "direct" | "explanatory" | "comparative" | "stepwise" | "clarifying";
}): "shallow" | "standard" | "deep" {
  if (input.responseIntent === "direct" && input.complexityScore < 0.38) return "shallow";
  if (input.responseIntent === "explanatory" || input.responseIntent === "stepwise") {
    return input.complexityScore >= 0.62 ? "deep" : "standard";
  }
  if (input.complexityScore >= 0.75) return "deep";
  return "standard";
}
