import type {
  CandidateAction,
  DominantPrinciple,
  FeasibleAction,
  LogicalDiscernmentInput,
} from "./logical-discernment-types";
import { clamp01, normalizeLogicalText, toUnique } from "./logical-discernment-utils";

function buildCarWashCandidates(normalized: string): CandidateAction[] {
  if (!/\b(carro|lavar|posto)\b/.test(normalized)) return [];
  return [
    {
      id: "car_wash_attach_existing_trip",
      label: "acoplar a lavagem a um deslocamento ja necessario",
      rationale: "minimiza custo marginal de combustivel e evita deslocamento exclusivo",
      risks: ["dependencia_de_janela_de_deslocamento"],
      alignsWith: ["economy", "effort_reduction"],
    },
    {
      id: "car_wash_single_direct_trip",
      label: "fazer uma unica ida direta em horario de menor transito",
      rationale: "mantem simplicidade operacional com custo adicional controlado",
      risks: ["custo_marginal_maior_que_acoplamento"],
      alignsWith: ["time", "comfort"],
    },
    {
      id: "car_wash_multiple_trips",
      label: "fazer multiplas idas separadas para lavar e resolver outras tarefas",
      rationale: "flexibilidade alta, mas pior eficiencia de custo marginal",
      risks: ["deslocamento_duplicado", "custo_total_elevado"],
      alignsWith: ["comfort"],
    },
  ];
}

function buildNightSafetyCandidates(normalized: string): CandidateAction[] {
  if (!/\b(voltar para casa|noite|tarde da noite)\b/.test(normalized)) return [];
  return [
    {
      id: "night_safe_transport",
      label: "usar transporte com rastreabilidade porta a porta",
      rationale: "prioriza seguranca mesmo com custo financeiro maior",
      risks: ["custo_financeiro_maior"],
      alignsWith: ["safety", "risk_reduction"],
    },
    {
      id: "night_public_path_lit",
      label: "escolher rota iluminada com menor exposicao e pontos de apoio",
      rationale: "reduz risco sem assumir custo maximo",
      risks: ["risco_residual_moderado"],
      alignsWith: ["safety", "economy"],
    },
  ];
}

function buildTimeSequenceCandidates(normalized: string): CandidateAction[] {
  if (!/\b(banco|farmacia|mercado)\b/.test(normalized)) return [];
  return [
    {
      id: "sequence_by_time_windows",
      label: "executar na ordem de janela de atendimento mais restrita para a menos restrita",
      rationale: "minimiza risco de fila e atraso no limite de tempo",
      risks: ["dependencia_de_fila_imprevista"],
      alignsWith: ["time", "effort_reduction"],
    },
    {
      id: "sequence_by_distance",
      label: "executar na sequencia otimizada por menor deslocamento total",
      rationale: "reduz tempo de deslocamento e variancia operacional",
      risks: ["janela_de_servico_pode_fechar"],
      alignsWith: ["time", "economy"],
    },
  ];
}

function buildGenericCandidates(principle: DominantPrinciple): CandidateAction[] {
  return [
    {
      id: "generic_principle_aligned",
      label: "executar plano unico alinhado ao principio dominante com menor custo marginal",
      rationale: "evita acoes redundantes e preserva objetivo principal",
      risks: ["dependencia_de_planejamento_previo"],
      alignsWith: [principle === "unknown" ? "accuracy" : principle],
    },
    {
      id: "generic_balanced",
      label: "executar plano balanceado entre objetivo principal e restricoes",
      rationale: "reduz risco de otimizar um criterio sacrificando viabilidade",
      risks: ["ganho_marginal_menor"],
      alignsWith: ["mixed"],
    },
  ];
}

function scoreAction(action: FeasibleAction, principle: DominantPrinciple): number {
  const cost = action.estimatedCost ?? 0.5;
  const marginal = action.estimatedMarginalCost ?? 0.5;
  const satisfies = action.satisfiesPrimaryGoal ? 1 : 0.55;
  const safeConstraint = action.satisfiesConstraints ? 1 : 0;
  const riskPenalty = Math.min(0.35, (action.risks?.length || 0) * 0.06);

  if (principle === "economy") return clamp01((1 - marginal) * 0.5 + (1 - cost) * 0.2 + satisfies * 0.2 + safeConstraint * 0.1 - riskPenalty);
  if (principle === "time") return clamp01((1 - cost) * 0.25 + (1 - marginal) * 0.2 + satisfies * 0.35 + safeConstraint * 0.2 - riskPenalty);
  if (principle === "safety") return clamp01(safeConstraint * 0.5 + satisfies * 0.25 + (1 - riskPenalty) * 0.25);
  if (principle === "risk_reduction") return clamp01(safeConstraint * 0.45 + (1 - riskPenalty) * 0.35 + satisfies * 0.2);
  if (principle === "effort_reduction") return clamp01((1 - marginal) * 0.25 + satisfies * 0.35 + safeConstraint * 0.25 + (1 - cost) * 0.15 - riskPenalty * 0.5);
  if (principle === "comfort") return clamp01((1 - marginal) * 0.2 + satisfies * 0.35 + safeConstraint * 0.25 + (1 - riskPenalty) * 0.2);
  if (principle === "accuracy") return clamp01(satisfies * 0.4 + safeConstraint * 0.4 + (1 - riskPenalty) * 0.2);
  return clamp01(satisfies * 0.35 + safeConstraint * 0.35 + (1 - marginal) * 0.15 + (1 - cost) * 0.15 - riskPenalty * 0.4);
}

export function proposeCandidateActions(
  input: LogicalDiscernmentInput,
  principle: DominantPrinciple,
): CandidateAction[] {
  const normalized = normalizeLogicalText(input.normalizedMessage || input.message);
  const candidates = [
    ...buildCarWashCandidates(normalized),
    ...buildNightSafetyCandidates(normalized),
    ...buildTimeSequenceCandidates(normalized),
  ];

  if (!candidates.length) {
    candidates.push(...buildGenericCandidates(principle));
  }

  const dedupedLabels = toUnique(candidates.map((item) => item.label), 8);
  return candidates.filter((item) => dedupedLabels.includes(item.label)).slice(0, 8);
}

export function selectRecommendedAction(
  feasibleActions: FeasibleAction[],
  principle: DominantPrinciple,
): { recommendedAction: string | null; recommendationReason: string | null } {
  if (!feasibleActions.length) {
    return {
      recommendedAction: null,
      recommendationReason: "nenhuma_acao_viavel_com_as_restricoes_atuais",
    };
  }

  const ranked = feasibleActions
    .map((action) => ({ action, score: scoreAction(action, principle) }))
    .sort((a, b) => b.score - a.score);

  const selected = ranked[0];
  return {
    recommendedAction: selected.action.label,
    recommendationReason: `acao_escolhida_por_melhor_relacao_objetivo_restricoes(score=${selected.score.toFixed(2)})`,
  };
}

