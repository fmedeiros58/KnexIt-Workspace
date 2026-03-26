/**
 * Responsabilidade do arquivo:
 * - Aplicar ordem progressiva obrigatoria da aquisicao de evidencia.
 * - Permitir override seguro sem quebrar a sequencia base.
 * - Garantir que web search so ocorra depois das camadas internas.
 */
import type { RetrievalStage } from "./iterative-acquisition-types";

const REQUIRED_ORDER: RetrievalStage[] = [
  "context_immediate",
  "transient_memory",
  "local_retriever",
  "rag_internal",
  "vector_lookup",
  "local_structured_sources",
  "internal_connectors",
  "web_multi_provider",
  "confirmatory_round",
  "contrastive_round",
];

export function buildRetrievalOrder(overrideOrder?: RetrievalStage[]): RetrievalStage[] {
  if (!overrideOrder?.length) return [...REQUIRED_ORDER];

  const candidateSet = new Set<RetrievalStage>(overrideOrder);
  return REQUIRED_ORDER.filter((stage) => candidateSet.has(stage));
}

export function getRequiredRetrievalOrder(): RetrievalStage[] {
  return [...REQUIRED_ORDER];
}

