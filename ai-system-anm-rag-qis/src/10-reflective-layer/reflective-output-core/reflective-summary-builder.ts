export interface ReflectiveSummaryBuilderInput {
  topAssumption?: string;
  topCaveat?: string;
  reflectionPriority: "low" | "medium" | "high";
}

export interface ReflectiveSummaryBuilderOutput {
  summary: string;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function reflectiveSummaryBuilder(input: ReflectiveSummaryBuilderInput): ReflectiveSummaryBuilderOutput {
  const assumption = input.topAssumption || "sem pressuposto dominante";
  const caveat = input.topCaveat || "sem caveat dominante";
  const summary = `Reflexao ${input.reflectionPriority}: pressuposto central (${assumption}); caveat central (${caveat}).`;

  return {
    summary,
    ok: true,
    component: "reflective-summary-builder",
    score: input.reflectionPriority === "high" ? 0.9 : input.reflectionPriority === "medium" ? 0.65 : 0.4,
    detail: summary,
    context: {
      priority: input.reflectionPriority,
    },
  };
}
