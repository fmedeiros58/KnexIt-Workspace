/** ai-system-anm */
export function selectResponseStrategy(input: {
  responseIntent: "direct" | "explanatory" | "comparative" | "stepwise" | "clarifying";
  ambiguity: number;
  cautionLevel: number;
}): "single_pass" | "structured_pass" | "evidence_first" | "concise_first" {
  if (input.responseIntent === "comparative") return "evidence_first";
  if (input.responseIntent === "stepwise") return "structured_pass";
  if (input.ambiguity >= 0.4) return "structured_pass";
  if (input.cautionLevel >= 0.65) return "concise_first";
  return "single_pass";
}
