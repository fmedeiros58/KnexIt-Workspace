export interface AlternativeInterpretationBuilderInput {
  message: string;
}

export interface AlternativeInterpretationBuilderOutput {
  interpretations: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function alternativeInterpretationBuilder(input: AlternativeInterpretationBuilderInput): AlternativeInterpretationBuilderOutput {
  const seed = input.message.replace(/\s+/g, " ").trim();
  const interpretations = [
    `${seed} (leitura factual direta)`,
    `${seed} (leitura contextual-comparativa)`,
    `${seed} (leitura hipotetica condicional)`,
  ];

  return {
    interpretations,
    ok: true,
    component: "alternative-interpretation-builder",
    score: 0.74,
    detail: `interpretations=${interpretations.length}`,
    context: {
      messageLength: seed.length,
    },
  };
}
