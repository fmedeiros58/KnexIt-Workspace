import type { LogicalFrame } from "./logical-discernment-types";
import { clamp01, normalizeLogicalText } from "./logical-discernment-utils";

function shouldAffectRouting(frame: Omit<LogicalFrame, "shouldAffectRouting" | "shouldAffectRetrieval" | "shouldTriggerOutputAudit">): boolean {
  if (frame.dominantPrinciple === "unknown") return false;
  if (frame.feasibleActions.length > 0) return true;
  if (frame.constraints.length > 0 && frame.primaryGoal) return true;
  return frame.secondaryGoals.length > 0;
}

function shouldAffectRetrieval(frame: Omit<LogicalFrame, "shouldAffectRouting" | "shouldAffectRetrieval" | "shouldTriggerOutputAudit">): boolean {
  const allText = normalizeLogicalText(
    [
      frame.primaryGoal || "",
      ...frame.constraints,
      ...frame.realWorldConditions,
      ...frame.secondaryGoals,
    ].join(" "),
  );
  return /\b(preco|valor|distancia|tempo real|agenda|horario|disponibilidade|cotacao|dados atuais)\b/.test(allText);
}

export function buildLogicalFrame(params: Omit<LogicalFrame, "shouldAffectRouting" | "shouldAffectRetrieval" | "shouldTriggerOutputAudit">): LogicalFrame {
  const routing = shouldAffectRouting(params);
  const retrieval = shouldAffectRetrieval(params);
  const hasStrongRecommendation =
    Boolean(params.recommendedAction) &&
    params.dominantPrinciple !== "unknown" &&
    params.confidence >= 0.45;
  const triggerAudit = routing || retrieval || hasStrongRecommendation;

  return {
    ...params,
    confidence: clamp01(params.confidence),
    shouldAffectRouting: routing,
    shouldAffectRetrieval: retrieval,
    shouldTriggerOutputAudit: triggerAudit,
  };
}
