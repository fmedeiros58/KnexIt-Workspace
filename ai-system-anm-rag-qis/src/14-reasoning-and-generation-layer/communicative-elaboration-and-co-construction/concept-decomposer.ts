/**
 * Responsabilidade do arquivo:
 * - Decompor a ideia nuclear em conceitos-raiz, dependencias e pressupostos.
 * - Reduzir monologo linear em favor de estrutura conceitual explicita.
 * - Manter decomposicao leve e aderente ao contexto do usuario.
 */
import type { ConceptDecomposition, IdeaSeed } from "./communicative-elaboration.types";

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 4);
}

function topTokens(tokens: string[], max = 6) {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map((item) => item[0]);
}

export function decomposeConcepts(seed: IdeaSeed): ConceptDecomposition {
  const tokens = tokenize(seed.coreClaim);
  const roots = topTokens(tokens, 4);
  const dependents = topTokens(tokens.filter((token) => !roots.includes(token)), 4);

  const implicitAssumptions: string[] = [];
  if (/\b(deve|precisa|necessario|obrigatorio)\b/.test(normalize(seed.coreClaim))) {
    implicitAssumptions.push("ha_pressuposto_normativo");
  }
  if (/\b(melhor|pior|eficiente|estavel|adequado)\b/.test(normalize(seed.coreClaim))) {
    implicitAssumptions.push("ha_criterio_de_valor_implicito");
  }
  if (!implicitAssumptions.length) implicitAssumptions.push("pressupostos_ainda_nao_explicitos");

  return {
    rootConcepts: roots.length ? roots : ["tema_central_nao_identificado"],
    dependentConcepts: dependents,
    implicitAssumptions,
  };
}

