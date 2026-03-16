export interface PreparatoryAmbiguityInput {
  text: string;
  baselineAmbiguity: number;
}

export interface PreparatoryAmbiguityResult {
  ambiguityScore: number;
  ambiguityFlags: string[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function preparatoryAmbiguityDetector(input: PreparatoryAmbiguityInput): PreparatoryAmbiguityResult {
  const text = `${input.text || ""}`.toLowerCase();
  const pronounCount = (text.match(/\b(isso|isto|aquilo|it|that|this)\b/g) || []).length;
  const openRefs = (text.match(/\b(ajeita|arruma|resolve|make it|do it)\b/g) || []).length;
  const score = clamp01(input.baselineAmbiguity + (pronounCount * 0.08) + (openRefs * 0.14));

  const flags: string[] = [];
  if (pronounCount > 0) flags.push("ambiguous_pronouns");
  if (openRefs > 0) flags.push("open_reference");
  if (score >= 0.6) flags.push("high_ambiguity");

  return {
    ambiguityScore: score,
    ambiguityFlags: flags,
  };
}
