export interface ScenarioPrioritizerInput {
  scenarios: string[];
}

export interface ScenarioPrioritizerOutput {
  prioritizedScenarios: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function rankScenario(value: string) {
  let score = 0;
  if (/conflito|contest|incerteza|uncertain/i.test(value)) score += 3;
  if (/complex|complexo|etapas|step/i.test(value)) score += 2;
  if (/base|objetiva|direct/i.test(value)) score += 1;
  return score;
}

export function scenarioPrioritizer(input: ScenarioPrioritizerInput): ScenarioPrioritizerOutput {
  const prioritizedScenarios = [...input.scenarios]
    .sort((a, b) => rankScenario(b) - rankScenario(a))
    .slice(0, 8);

  return {
    prioritizedScenarios,
    ok: true,
    component: "scenario-prioritizer",
    score: Number(Math.min(1, prioritizedScenarios.length / 8).toFixed(4)),
    detail: `prioritized=${prioritizedScenarios.length}`,
    context: {
      originalCount: input.scenarios.length,
    },
  };
}
