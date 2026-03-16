export interface SecondOrderConsequenceEngineInput {
  consequences: string[];
}

export interface SecondOrderConsequenceEngineOutput {
  secondOrderConsequences: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function secondOrderConsequenceEngine(input: SecondOrderConsequenceEngineInput): SecondOrderConsequenceEngineOutput {
  const secondOrderConsequences = input.consequences
    .slice(0, 4)
    .map((item) => `Segunda ordem: se "${item}", entao aumenta a necessidade de validacao iterativa.`);

  return {
    secondOrderConsequences,
    ok: true,
    component: "second-order-consequence-engine",
    score: Number(Math.min(1, secondOrderConsequences.length / 6).toFixed(4)),
    detail: `secondOrder=${secondOrderConsequences.length}`,
    context: {
      consequenceCount: input.consequences.length,
    },
  };
}
