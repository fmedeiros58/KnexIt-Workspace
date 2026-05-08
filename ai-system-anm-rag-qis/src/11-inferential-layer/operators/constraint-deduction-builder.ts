/**
 * @file constraint-deduction-builder.ts
 * @description Monta um esqueleto de deducao por restricoes.
 * @layer 11-inferential-layer
 * @purpose Apoiar problemas fechados com premissas e conclusao curta.
 * @inputs Premissas, restricoes e conclusao candidata.
 * @outputs Etapas de deducao.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy camada inferencial e validadores de completude.
 * @invariants Nao deve adicionar premissas que nao foram fornecidas.
 * @notes O operador produz estrutura; a geracao decide verbalizacao final.
 */
export function buildConstraintDeduction(input: {
  premises: string[];
  constraints: string[];
  conclusion: string;
}): string[] {
  return [
    ...input.premises.map((premise) => `premise:${premise}`),
    ...input.constraints.map((constraint) => `constraint:${constraint}`),
    `conclusion:${input.conclusion}`,
  ].filter(Boolean);
}

