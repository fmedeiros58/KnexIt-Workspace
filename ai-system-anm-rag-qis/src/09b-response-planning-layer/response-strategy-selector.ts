/** ai-system-anm */
export type ResponseIntent =
  | "direct"
  | "explanatory"
  | "comparative"
  | "stepwise"
  | "clarifying";

export type ResponseStrategy =
  | "single_pass"
  | "structured_pass"
  | "evidence_first"
  | "concise_first";

export interface SelectResponseStrategyInput {
  responseIntent: ResponseIntent;
  ambiguity: number;
  cautionLevel: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function selectResponseStrategy(
  input: SelectResponseStrategyInput,
): ResponseStrategy {
  const ambiguity = clamp01(input.ambiguity);
  const cautionLevel = clamp01(input.cautionLevel);

  if (input.responseIntent === "stepwise") {
    return "structured_pass";
  }

  if (input.responseIntent === "comparative") {
    return cautionLevel >= 0.72 ? "structured_pass" : "evidence_first";
  }

  if (input.responseIntent === "clarifying") {
    return cautionLevel >= 0.58 || ambiguity >= 0.5
      ? "concise_first"
      : "single_pass";
  }

  if (input.responseIntent === "explanatory") {
    if (ambiguity >= 0.58) return "structured_pass";
    if (cautionLevel >= 0.72) return "concise_first";
    return "single_pass";
  }

  if (input.responseIntent === "direct") {
    if (ambiguity >= 0.52) return "structured_pass";
    if (cautionLevel >= 0.68) return "concise_first";
    return "single_pass";
  }

  return "single_pass";
}