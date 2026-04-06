import type { DominantPrinciple, GoalExtraction, LogicalDiscernmentInput } from "./logical-discernment-types";
import { normalizeLogicalText } from "./logical-discernment-utils";

function extractGoalByPattern(normalized: string): string | null {
  const patterns = [
    /\b(?:para|pra)\s+([^.;!?]{6,120})/,
    /\b(?:quero|preciso|necessito)\s+([^.;!?]{6,120})/,
    /\bo que eu faco para\s+([^.;!?]{6,120})/,
    /\bqual a melhor forma de\s+([^.;!?]{6,120})/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const goal = match[1].replace(/\s+/g, " ").trim();
    if (goal.length >= 6) return goal;
  }
  return null;
}

function defaultGoalByPrinciple(principle: DominantPrinciple): string | null {
  if (principle === "economy") return "minimizar custo adicional real mantendo o objetivo principal";
  if (principle === "time") return "maximizar velocidade de execucao com sequencia viavel";
  if (principle === "safety") return "minimizar exposicao a risco acima de ganhos de custo";
  if (principle === "accuracy") return "maximizar confiabilidade da acao recomendada";
  if (principle === "comfort") return "equilibrar resultado com menor desconforto operacional";
  if (principle === "risk_reduction") return "reduzir riscos relevantes antes de otimizar ganhos secundarios";
  if (principle === "effort_reduction") return "reduzir esforco desnecessario sem perder efetividade";
  return null;
}

export function extractRealGoal(
  input: LogicalDiscernmentInput,
  dominantPrinciple: DominantPrinciple,
): GoalExtraction {
  const normalized = normalizeLogicalText(input.normalizedMessage || input.message);
  if (!normalized) {
    return {
      primaryGoal: null,
      confidence: 0,
      evidence: ["empty_prompt"],
    };
  }

  const extractedGoal = extractGoalByPattern(normalized);
  if (extractedGoal) {
    return {
      primaryGoal: extractedGoal,
      confidence: 0.78,
      evidence: ["goal_pattern_match"],
    };
  }

  const byPrinciple = defaultGoalByPrinciple(dominantPrinciple);
  if (byPrinciple) {
    return {
      primaryGoal: byPrinciple,
      confidence: 0.55,
      evidence: [`principle_default=${dominantPrinciple}`],
    };
  }

  return {
    primaryGoal: null,
    confidence: 0.25,
    evidence: ["goal_not_explicit"],
  };
}

