import type { ReasoningContract, SolutionModel } from "./deliberative-task-contract-types";

function pickPreferredModel(solutionModels: SolutionModel[]): SolutionModel | null {
  if (!solutionModels.length) return null;
  return solutionModels[0];
}

export function selfObjectionGenerator(
  contract: ReasoningContract | null,
  solutionModels: SolutionModel[],
): string | null {
  if (!contract) return null;
  if (contract.objectionStrengthLevel < 0.45 && solutionModels.length === 0) return null;

  const preferred = pickPreferredModel(solutionModels);
  const preferredLabel = preferred?.title || "solucao preferida";

  return [
    `Steelman contra ${preferredLabel}:`,
    "1) Coerencia: o criterio de escolha pode depender de premissas operacionais contestaveis.",
    "2) Custo oculto: a estrategia pode deslocar custos para dimensoes nao priorizadas no modelo.",
    "3) Viabilidade institucional: a implementacao pode exigir capacidades que o contexto nao garante.",
    "4) Circularidade: a justificativa pode pressupor o proprio valor que deveria demonstrar.",
    "5) Robustez: sob dados incompletos, a solucao pode perder desempenho fora do cenario esperado.",
  ].join(" ");
}
