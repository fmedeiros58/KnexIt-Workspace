/** ai-system-anm */
export function resolveFormality(input: { targetRestraint: number; selectedMode: string }): "low" | "medium" | "high" {
  if (input.selectedMode === "technical") return "high";
  if (input.targetRestraint >= 0.74) return "high";
  if (input.targetRestraint <= 0.42) return "low";
  return "medium";
}
