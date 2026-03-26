/**
 * Responsabilidade do arquivo:
 * - Auditar competicao entre hipoteses para evitar fechamento precoce.
 * - Verificar se existe pluralidade minima quando o tema e ambiguo.
 * - Produzir sinal de robustez comparativa para validacao final.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";

export function validateHypothesisCompetition(state: ProcessingState) {
  const total = state.hypothesisSet.length;
  const distinctClaims = new Set(
    state.hypothesisSet.map((item) =>
      `${item.claim || ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  ).size;

  const needsCompetition = state.complexityProfile.ambiguity >= 0.42 || state.executionPlan.steps.includes("epistemic_audit");
  const ok = !needsCompetition || total >= 2 || distinctClaims >= 2;

  return {
    ok,
    totalHypotheses: total,
    distinctHypotheses: distinctClaims,
    needsCompetition,
    issues: ok ? [] : ["hypothesis_competition_insufficient"],
  };
}

