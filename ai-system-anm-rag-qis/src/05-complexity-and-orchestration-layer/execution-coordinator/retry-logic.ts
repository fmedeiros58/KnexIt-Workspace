import type { PipelineRoute } from "../../shared/enums/pipeline-enums";

export interface RetryLogicInput {
  route: PipelineRoute;
  complexityScore: number;
  urgency: "low" | "medium" | "high";
  priorFailureCount: number;
}

export interface RetryLogicOutput {
  maxAttempts: number;
  backoffMs: number;
  retryableStages: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function retryLogic(input: RetryLogicInput): RetryLogicOutput {
  const routeBoost =
    input.route === "quantum-state" ? 1 :
    input.route === "inferential" ? 0.6 :
    input.route === "reflective" ? 0.3 :
    0;
  const urgencyPenalty =
    input.urgency === "high" ? 1 :
    input.urgency === "medium" ? 0.4 :
    0;

  const complexity = clamp01(input.complexityScore);
  const priorPenalty = Math.min(1, input.priorFailureCount * 0.34);

  const maxAttempts = Math.max(
    1,
    Math.min(
      4,
      Math.round(1 + (complexity * 1.3) + routeBoost - urgencyPenalty - priorPenalty),
    ),
  );
  const backoffMs = Math.round(180 + (complexity * 260) + (input.priorFailureCount * 120));

  const retryableStages =
    input.route === "minimum"
      ? ["generation", "validation"]
      : input.route === "reflective"
        ? ["knowledge", "generation", "validation"]
        : ["memory", "knowledge", "quantum", "generation", "validation"];

  return {
    maxAttempts,
    backoffMs,
    retryableStages,
    ok: true,
    component: "retry-logic",
    score: Number(clamp01((maxAttempts / 4) * 0.6 + (complexity * 0.4)).toFixed(4)),
    detail: `attempts=${maxAttempts}; backoffMs=${backoffMs}`,
    context: {
      urgency: input.urgency,
      priorFailureCount: input.priorFailureCount,
      route: input.route,
    },
  };
}
