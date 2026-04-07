import type { DominantPrinciple, FeasibleAction, MarginalCostEstimate } from "./logical-discernment-types";
import { normalizeLogicalText } from "./logical-discernment-utils";

function estimateFromLabel(label: string): { cost: number; marginal: number } {
  const normalized = normalizeLogicalText(label);
  if (/\b(acoplar|rota ja prevista|deslocamento necessario)\b/.test(normalized)) {
    return { cost: 0.28, marginal: 0.12 };
  }
  if (/\b(sequencia otimizada|ordem otimizada|planejamento em lote)\b/.test(normalized)) {
    return { cost: 0.35, marginal: 0.18 };
  }
  if (/\b(aplicativo porta a porta|transporte seguro)\b/.test(normalized)) {
    return { cost: 0.62, marginal: 0.44 };
  }
  if (/\b(multipla|multiplas idas|deslocamento duplicado)\b/.test(normalized)) {
    return { cost: 0.84, marginal: 0.79 };
  }
  if (/\b(ida unica imediata)\b/.test(normalized)) {
    return { cost: 0.52, marginal: 0.48 };
  }
  return { cost: 0.5, marginal: 0.5 };
}

function relevantCostsByPrinciple(principle: DominantPrinciple): string[] {
  if (principle === "economy") return ["custo_marginal", "custo_adicional", "custo_oportunidade"];
  if (principle === "time") return ["tempo_total", "tempo_de_espera", "tempo_de_deslocamento"];
  if (principle === "safety") return ["risco_operacional", "exposicao_noturna", "confiabilidade_meio"];
  if (principle === "accuracy") return ["erro_de_execucao", "confiabilidade_informacional"];
  if (principle === "comfort") return ["esforco_fisico", "conveniencia_operacional"];
  if (principle === "risk_reduction") return ["risco_residual", "exposicao_a_falha"];
  if (principle === "effort_reduction") return ["esforco_total", "friccao_operacional"];
  return ["tradeoff_principal"];
}

function irrelevantCostsByPrinciple(principle: DominantPrinciple): string[] {
  if (principle === "economy") return ["conforto_secundario_sem_impacto_de_custo"];
  if (principle === "time") return ["custo_financeiro_pequeno_sem_impacto_temporal"];
  if (principle === "safety") return ["economia_marginal_com_aumento_de_risco"];
  return [];
}

export function estimateMarginalCost(params: {
  action: FeasibleAction;
  dominantPrinciple: DominantPrinciple;
}): MarginalCostEstimate {
  const fromLabel = estimateFromLabel(params.action.label);
  return {
    estimatedCost: fromLabel.cost,
    estimatedMarginalCost: fromLabel.marginal,
    relevantCosts: relevantCostsByPrinciple(params.dominantPrinciple),
    irrelevantCosts: irrelevantCostsByPrinciple(params.dominantPrinciple),
  };
}

