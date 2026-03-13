export interface DownstreamEffectsMapperInput {
  implications: string[];
  scenarios: string[];
}

export interface DownstreamEffectsMapperOutput {
  effects: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function downstreamEffectsMapper(input: DownstreamEffectsMapperInput): DownstreamEffectsMapperOutput {
  const effects: string[] = [];
  for (const implication of input.implications.slice(0, 3)) {
    effects.push(`Efeito downstream: ${implication}`);
  }
  for (const scenario of input.scenarios.slice(0, 2)) {
    effects.push(`Cenario operacional: ${scenario}`);
  }

  return {
    effects: effects.slice(0, 8),
    ok: true,
    component: "downstream-effects-mapper",
    score: Number(Math.min(1, effects.length / 8).toFixed(4)),
    detail: `effects=${effects.length}`,
    context: {
      implicationCount: input.implications.length,
      scenarioCount: input.scenarios.length,
    },
  };
}
