/**
 * ai-system-anm
 * Escora intensidade emocional para uso regulador de planejamento e entrega.
 */
function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function punctuationIntensity(text: string) {
  const exclamations = (text.match(/!/g) || []).length;
  const uppercaseSpans = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  return Math.min(1, (exclamations * 0.12) + (uppercaseSpans * 0.18));
}

export function scoreEmotionalIntensity(input: {
  text: string;
  dominantAffect: "neutral" | "frustrated" | "anxious" | "enthusiastic" | "concerned" | "calm";
}): number {
  const baseByAffect = {
    neutral: 0.16,
    calm: 0.22,
    concerned: 0.44,
    enthusiastic: 0.48,
    anxious: 0.62,
    frustrated: 0.72,
  } satisfies Record<typeof input.dominantAffect, number>;

  return clamp01(baseByAffect[input.dominantAffect] + punctuationIntensity(input.text));
}
