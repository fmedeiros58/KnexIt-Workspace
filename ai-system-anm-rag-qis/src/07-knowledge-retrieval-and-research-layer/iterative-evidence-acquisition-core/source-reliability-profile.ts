/**
 * Responsabilidade do arquivo:
 * - Definir pre-pesos de confiabilidade por tipo de fonte/provedor.
 * - Apoiar ranking preliminar sem substituir validacao final da camada 17.
 * - Permitir ajuste centralizado para politicas de evidencia.
 */
import type { FunctionalSourceType } from "./iterative-acquisition-types";

const SOURCE_BASE_WEIGHT: Record<FunctionalSourceType, number> = {
  context: 0.38,
  memory: 0.44,
  retriever: 0.62,
  rag: 0.68,
  vector: 0.6,
  docs: 0.72,
  connector: 0.66,
  web: 0.58,
  existing: 0.52,
  internal: 0.7,
};

const PROVIDER_WEIGHT: Record<string, number> = {
  wikipedia_api: 0.67,
  bing_html: 0.58,
  duckduckgo_html: 0.56,
  legacy_web_fallback: 0.55,
  internal_connector: 0.72,
  local_cache: 0.5,
  rag_retriever: 0.71,
};

export function resolveSourceReliabilityWeight(sourceType: FunctionalSourceType, provider: string): number {
  const sourceWeight = SOURCE_BASE_WEIGHT[sourceType] ?? 0.5;
  const providerWeight = PROVIDER_WEIGHT[(provider || "").toLowerCase()] ?? 0.55;
  const combined = (sourceWeight * 0.7) + (providerWeight * 0.3);
  return Math.max(0.1, Math.min(0.95, combined));
}

