/**
 * Responsabilidade do arquivo:
 * - Consolidar um loop leve de refinamento sobre o plano co-construtivo.
 * - Explicitar pontos em aberto e prompts de melhoria incremental.
 * - Preparar saida para composicao do draft final no generation layer.
 */
import type {
  CoConstructionPlan,
  HypothesisBranch,
  RefinementLoopResult,
} from "./communicative-elaboration.types";

export function runRefinementLoop(plan: CoConstructionPlan, branches: HypothesisBranch[]): RefinementLoopResult {
  const unresolvedPoints: string[] = [];
  if (!branches.length) unresolvedPoints.push("sem_hipoteses_para_validacao_competitiva");
  if (!plan.reasoningMoves.length) unresolvedPoints.push("sem_progressao_argumentativa_explicita");
  if (plan.optionalClarifyingQuestion) unresolvedPoints.push("delimitacao_de_preferencia_pendente");

  const refinementPrompts = [
    "separar_clauses_factuais_de_hipoteticas",
    "explicitar_limites_de_evidencia",
    "reduzir_saltos_inferenciais",
    ...(plan.optionalClarifyingQuestion ? ["perguntar_preferencia_de_profundidade"] : []),
  ];

  const synthesizedDraft = [
    plan.openingMove,
    ...plan.reasoningMoves,
    branches.length
      ? `Hipoteses em jogo: ${branches.slice(0, 2).map((row) => row.claim).join(" | ")}`
      : "Hipotese base ainda em refinamento.",
    plan.closureMove,
  ].join("\n");

  return {
    synthesizedDraft,
    refinementPrompts,
    unresolvedPoints,
  };
}

