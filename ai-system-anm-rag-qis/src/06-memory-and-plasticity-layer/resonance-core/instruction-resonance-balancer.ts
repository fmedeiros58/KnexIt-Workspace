import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface InstructionResonanceBalancerInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface InstructionResonanceBalancerOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function instructionResonanceBalancer(
  input: InstructionResonanceBalancerInput = {},
): InstructionResonanceBalancerOutput {
  const analysis = analyzeMemoryText(input.text);
  const instructionCues = countMemoryMatches(
    analysis.normalized,
    /\b(apenas|somente|evite|nao|sem|must|should|avoid|strict|constraint)\b/g,
  );
  const flexibilityCues = countMemoryMatches(
    analysis.normalized,
    /\b(pode|talvez|opcional|flexivel|can|maybe|optional|flexible)\b/g,
  );

  const inferredScore = clamp01(
    0.28 +
    (Math.min(1, instructionCues / 5) * 0.42) -
    (Math.min(1, flexibilityCues / 5) * 0.14) +
    (Math.min(1, analysis.tokenCount / 30) * 0.08),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "instruction-resonance-balancer",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `instructionCues=${instructionCues}; flexibilityCues=${flexibilityCues}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      instructionCues,
      flexibilityCues,
      hasText: Boolean(analysis.text),
    },
  };
}
