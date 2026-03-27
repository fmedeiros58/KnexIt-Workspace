/** ai-system-anm */
export function buildToneProfile(input: {
  dominantAffect: "neutral" | "frustrated" | "anxious" | "enthusiastic" | "concerned" | "calm";
  responseIntent: "direct" | "explanatory" | "comparative" | "stepwise" | "clarifying";
}): "neutral" | "warm" | "technical" | "supportive" {
  if (input.responseIntent === "comparative" || input.responseIntent === "stepwise") return "technical";
  if (input.dominantAffect === "frustrated" || input.dominantAffect === "anxious") return "supportive";
  if (input.dominantAffect === "enthusiastic" || input.dominantAffect === "calm") return "warm";
  return "neutral";
}
