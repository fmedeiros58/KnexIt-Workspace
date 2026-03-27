/**
 * ai-system-anm
 * Construtor de contexto afetivo para orientar cautela, nao para raciocinar por emocao.
 */
function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function buildAffectiveContext(input: {
  dominantAffect: "neutral" | "frustrated" | "anxious" | "enthusiastic" | "concerned" | "calm";
  emotionalIntensity: number;
  markers: string[];
}) {
  const cautionBoost =
    input.dominantAffect === "frustrated" || input.dominantAffect === "anxious"
      ? 0.25
      : input.dominantAffect === "concerned"
        ? 0.14
        : 0.04;

  const cautionLevel = clamp01((input.emotionalIntensity * 0.55) + cautionBoost);

  return {
    dominantAffect: input.dominantAffect,
    emotionalIntensity: input.emotionalIntensity,
    cautionLevel,
    affectiveMarkers: input.markers,
  };
}
