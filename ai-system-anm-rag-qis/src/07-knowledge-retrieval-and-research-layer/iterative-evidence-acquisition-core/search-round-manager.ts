/**
 * Responsabilidade do arquivo:
 * - Gerenciar rounds iterativos (exploracao, focalizacao, confirmacao, contraste).
 * - Definir objetivos por rodada e subset de estagios executados.
 * - Aplicar condicoes de escalada para confirmacao e contraste.
 */
import type {
  IterativeAcquisitionPolicy,
  RetrievalStage,
  SearchRoundKind,
  SearchRoundPlan,
} from "./iterative-acquisition-types";

function buildStageSubset(order: RetrievalStage[], round: SearchRoundKind): RetrievalStage[] {
  if (round === "exploration") {
    return order.filter((stage) =>
      [
        "context_immediate",
        "transient_memory",
        "local_retriever",
        "rag_internal",
      ].includes(stage),
    );
  }
  if (round === "focalization") {
    return order.filter((stage) =>
      [
        "local_retriever",
        "rag_internal",
        "vector_lookup",
        "local_structured_sources",
        "internal_connectors",
      ].includes(stage),
    );
  }
  if (round === "confirmation") {
    return order.filter((stage) =>
      ["local_structured_sources", "internal_connectors", "web_multi_provider", "confirmatory_round"].includes(stage),
    );
  }
  return order.filter((stage) => ["web_multi_provider", "contrastive_round"].includes(stage));
}

export function buildSearchRoundPlan(policy: IterativeAcquisitionPolicy): SearchRoundPlan[] {
  const rounds: SearchRoundKind[] = ["exploration", "focalization"];
  if (policy.enableConfirmatoryRound) rounds.push("confirmation");
  if (policy.enableContrastiveRound) rounds.push("contrast");

  return rounds
    .slice(0, policy.searchBudget.maxRounds)
    .map((round) => ({
      round,
      objective:
        round === "exploration"
          ? "ampliar cobertura e mapear fontes principais"
          : round === "focalization"
            ? "reduzir ruido e aumentar precisao"
            : round === "confirmation"
              ? "confirmar achados em fontes independentes"
              : "buscar conflito, excecao e desatualizacao",
      stages: buildStageSubset(policy.order, round),
    }))
    .filter((row) => row.stages.length > 0);
}

