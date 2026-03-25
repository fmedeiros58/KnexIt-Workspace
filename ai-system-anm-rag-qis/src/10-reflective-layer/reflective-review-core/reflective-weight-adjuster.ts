export interface ReflectiveWeightAdjusterInput {
  gapScore: number;
  tensionScore: number;
  overclaimRisk: number;
  consistencyScore: number;
}

export interface ReflectiveWeightAdjusterOutput {
  reflectionWeight: number;
  priority: "low" | "medium" | "high";
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function reflectiveWeightAdjuster(input: ReflectiveWeightAdjusterInput): ReflectiveWeightAdjusterOutput {
  const raw = (input.gapScore * 0.28) + (input.tensionScore * 0.24) + (input.overclaimRisk * 0.32) + ((1 - input.consistencyScore) * 0.16);
  const reflectionWeight = clamp01(raw);
  const priority: "low" | "medium" | "high" =
    reflectionWeight >= 0.62 ? "high" :
    reflectionWeight >= 0.34 ? "medium" :
    "low";

  return {
    reflectionWeight: Number(reflectionWeight.toFixed(4)),
    priority,
    ok: true,
    component: "reflective-weight-adjuster",
    score: Number(reflectionWeight.toFixed(4)),
    detail: priority,
    context: {
      gapScore: input.gapScore,
      tensionScore: input.tensionScore,
      overclaimRisk: input.overclaimRisk,
      consistencyScore: input.consistencyScore,
    },
  };
}
