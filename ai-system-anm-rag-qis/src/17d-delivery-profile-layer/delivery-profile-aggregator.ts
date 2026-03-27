/** ai-system-anm */
function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function aggregateDeliveryProfile(input: {
  tone: "neutral" | "warm" | "technical" | "supportive";
  density: "compact" | "balanced" | "detailed";
  formality: "low" | "medium" | "high";
  technicality: number;
  proximity: number;
  rhythm: "direct" | "progressive" | "didactic";
}) {
  return {
    tone: input.tone,
    density: input.density,
    formality: input.formality,
    technicality: clamp01(input.technicality),
    proximity: clamp01(input.proximity),
    rhythm: input.rhythm,
  };
}
