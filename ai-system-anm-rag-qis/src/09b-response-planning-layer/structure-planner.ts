/** ai-system-anm */
export function planStructure(input: {
  responseIntent: "direct" | "explanatory" | "comparative" | "stepwise" | "clarifying";
  depthLevel: "shallow" | "standard" | "deep";
}): string[] {
  if (input.responseIntent === "direct") return ["conclusion"];
  if (input.responseIntent === "comparative") return ["criteria", "comparison", "conclusion"];
  if (input.responseIntent === "stepwise") return ["goal", "steps", "checkpoint", "conclusion"];
  if (input.responseIntent === "clarifying") return ["clarification", "answer", "confirmation"];

  if (input.depthLevel === "deep") return ["premise", "analysis", "validation", "conclusion"];
  return ["answer", "brief_reason", "conclusion"];
}
