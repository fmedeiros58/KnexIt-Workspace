/** ai-system-anm */

export type ResponseIntent =
  | "direct"
  | "explanatory"
  | "comparative"
  | "stepwise"
  | "clarifying";

export type DepthLevel = "shallow" | "standard" | "deep";

export type StructureToken =
  | "goal"
  | "clarification"
  | "premise"
  | "criteria"
  | "answer"
  | "steps"
  | "checkpoint"
  | "analysis"
  | "comparison"
  | "brief_reason"
  | "validation"
  | "confirmation"
  | "conclusion";

export interface PlanStructureInput {
  responseIntent: ResponseIntent;
  depthLevel: DepthLevel;
}

function uniquePlan(tokens: StructureToken[]): string[] {
  return Array.from(new Set(tokens));
}

export function planStructure(input: PlanStructureInput): string[] {
  const { responseIntent, depthLevel } = input;

  if (responseIntent === "direct") {
    if (depthLevel === "deep") {
      return uniquePlan(["premise", "answer", "validation", "conclusion"]);
    }
    if (depthLevel === "standard") {
      return uniquePlan(["answer", "brief_reason", "conclusion"]);
    }
    return uniquePlan(["answer", "conclusion"]);
  }

  if (responseIntent === "comparative") {
    if (depthLevel === "deep") {
      return uniquePlan(["criteria", "comparison", "validation", "conclusion"]);
    }
    return uniquePlan(["criteria", "comparison", "conclusion"]);
  }

  if (responseIntent === "stepwise") {
    if (depthLevel === "deep") {
      return uniquePlan(["goal", "steps", "checkpoint", "validation", "conclusion"]);
    }
    return uniquePlan(["goal", "steps", "checkpoint", "conclusion"]);
  }

  if (responseIntent === "clarifying") {
    if (depthLevel === "deep") {
      return uniquePlan(["clarification", "answer", "validation", "confirmation"]);
    }
    return uniquePlan(["clarification", "answer", "confirmation"]);
  }

  if (responseIntent === "explanatory") {
    if (depthLevel === "deep") {
      return uniquePlan(["premise", "analysis", "validation", "conclusion"]);
    }
    if (depthLevel === "standard") {
      return uniquePlan(["answer", "analysis", "conclusion"]);
    }
    return uniquePlan(["answer", "brief_reason", "conclusion"]);
  }

  if (depthLevel === "deep") {
    return uniquePlan(["premise", "analysis", "validation", "conclusion"]);
  }

  if (depthLevel === "standard") {
    return uniquePlan(["answer", "analysis", "conclusion"]);
  }

  return uniquePlan(["answer", "conclusion"]);
}