import type { ConstraintKind, ConstraintLockResult } from "./objective-rationality-types";

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function pushUnique(target: ConstraintKind[], ...items: ConstraintKind[]) {
  for (const item of items) {
    if (!target.includes(item)) target.push(item);
  }
}

export function lockExplicitConstraints(query: string): ConstraintLockResult {
  const normalized = normalize(query);
  const constraints: ConstraintKind[] = [];
  const reasons: string[] = [];

  if (
    /\b(sem preco|sem precos|nao quero saber de preco|nao quero saber de precos|nao analise preco|nao analise precos|sem avaliar preco|sem avaliar precos|sem considerar preco|sem considerar precos|ignore preco|ignore precos|sem custo|ignore custo)\b/.test(
      normalized,
    )
  ) {
    pushUnique(constraints, "exclude_price", "exclude_cost");
    reasons.push("price_excluded");
  }

  if (
    /\b(sem avaliar nada|sem considerar outros fatores|sem contexto adicional|sem analisar outros fatores|sem comparar contexto)\b/.test(
      normalized,
    )
  ) {
    pushUnique(constraints, "exclude_contextual_expansion");
    reasons.push("contextual_expansion_excluded");
  }

  if (
    /\b(curto e grosso|curta e grossa|resposta curta|so a resposta|apenas a resposta|resuma na resposta)\b/.test(
      normalized,
    )
  ) {
    pushUnique(constraints, "require_short_answer");
    reasons.push("short_answer_required");
  }

  if (/\b(em absoluto|absolutamente|em termos absolutos|apenas em absoluto)\b/.test(normalized)) {
    pushUnique(constraints, "require_absolute_evaluation");
    reasons.push("absolute_evaluation_required");
  }

  if (
    /\b(minha opiniao|sua opiniao|quero sua opiniao|me diga o que e melhor|qual e melhor)\b/.test(
      normalized,
    )
  ) {
    pushUnique(constraints, "require_direct_opinion");
    reasons.push("direct_opinion_required");
  }

  if (
    /\b(nao relativize|nao condicione|nao diga depende|sem depender)\b/.test(normalized)
  ) {
    pushUnique(constraints, "exclude_multiple_conditions");
    reasons.push("conditional_branching_excluded");
  }

  return {
    locked: constraints.length > 0,
    constraints,
    reasons,
  };
}
