export interface ConditionalPathEstimatorInput {
  scenarios: string[];
  uncertainty: number;
}

export interface ConditionalPathEstimatorOutput {
  paths: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function conditionalPathEstimator(input: ConditionalPathEstimatorInput): ConditionalPathEstimatorOutput {
  const paths = input.scenarios.slice(0, 4).map((scenario, index) =>
    `Rota condicional ${index + 1}: se ${scenario.toLowerCase()}, aplicar nivel de cautela ${input.uncertainty >= 0.45 ? "alto" : "moderado"}.`,
  );

  return {
    paths,
    ok: true,
    component: "conditional-path-estimator",
    score: Number(Math.min(1, (paths.length * 0.18) + (input.uncertainty * 0.4)).toFixed(4)),
    detail: `paths=${paths.length}`,
    context: {
      uncertainty: input.uncertainty,
      scenarioCount: input.scenarios.length,
    },
  };
}
