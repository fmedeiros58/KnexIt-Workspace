/** ai-system-anm */
export function resolveDensity(input: { depthLevel: "shallow" | "standard" | "deep"; responseIntent: string }): "compact" | "balanced" | "detailed" {
  if (input.depthLevel === "shallow") return "compact";
  if (input.depthLevel === "deep") return "detailed";
  if (input.responseIntent === "direct") return "compact";
  return "balanced";
}
