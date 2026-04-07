import { detectDominantPrinciple } from "./dominant-principle-detector";
import { extractRealGoal } from "./real-goal-extractor";
import { extractSecondaryGoals } from "./secondary-goal-extractor";
import { mapConstraints } from "./constraint-mapper";
import { extractRealWorldConditions } from "./real-world-condition-extractor";
import { proposeCandidateActions, selectRecommendedAction } from "./action-optimizer";
import { evaluateFeasibility } from "./feasibility-checker";
import { estimateMarginalCost } from "./marginal-cost-estimator";
import { buildLogicalFrame } from "./logical-frame-builder";
import type {
  DominantPrinciple,
  LogicalDiscernmentInput,
  LogicalDiscernmentResult,
} from "./logical-discernment-types";
import { clamp01, normalizeLogicalText } from "./logical-discernment-utils";

function isLowImpactTurn(input: LogicalDiscernmentInput): boolean {
  const normalized = normalizeLogicalText(input.normalizedMessage || input.message);
  if (!normalized) return true;
  const shortGreeting = /^(oi+|ola+|opa+|bom dia|boa tarde|boa noite|tudo bem)\b/.test(normalized);
  const smallTalk = /\b(como vai|beleza|blz|de boa|tranquilo)\b/.test(normalized);
  const tokenCount = input.tokenCount || normalized.split(" ").filter(Boolean).length;
  const questionCount = input.questionCount || ((normalized.match(/\?/g) || []).length);
  if (input.hasGreetingSignal && tokenCount <= 8) return true;
  return (shortGreeting || smallTalk) && tokenCount <= 8 && questionCount <= 1;
}

function isAbstractNonPracticalTurn(input: LogicalDiscernmentInput): boolean {
  const normalized = normalizeLogicalText(input.normalizedMessage || input.message);
  if (!normalized) return false;

  const hasNormativeAbstractMarkers =
    /\b(principios normativos|liberdade basica|bem-estar agregado|bem estar agregado|regra universal|contradicao real|inconsistencia de aplicacao|premissas escondidas|demonstracao formal)\b/.test(
      normalized,
    ) ||
    (/\b(decisao coletiva)\b/.test(normalized) && /\b(individuo inocente)\b/.test(normalized));

  if (!hasNormativeAbstractMarkers) return false;

  const hasPracticalOptimizationCue =
    /\b(gastar menos|menor custo|mais rapido|mais seguro|melhor ordem|sequencia|deslocamento|tempo limite|orcamento pessoal|posto|carro|farmacia|mercado|voltar para casa)\b/.test(
      normalized,
    );

  return !hasPracticalOptimizationCue;
}

function inferRelevantAndIrrelevantCosts(principle: DominantPrinciple) {
  if (principle === "economy") {
    return {
      relevant: ["custo_marginal", "custo_adicional", "custo_oportunidade"],
      irrelevant: ["custo_total_sem_variacao_marginal"],
    };
  }
  if (principle === "time") {
    return {
      relevant: ["tempo_total", "tempo_de_espera", "tempo_de_deslocamento"],
      irrelevant: ["economia_monetaria_pequena_sem_impacto_temporal"],
    };
  }
  if (principle === "safety" || principle === "risk_reduction") {
    return {
      relevant: ["exposicao_a_risco", "risco_residual", "confiabilidade_do_meio"],
      irrelevant: ["economia_marginal_com_aumento_de_risco"],
    };
  }
  if (principle === "effort_reduction") {
    return {
      relevant: ["esforco_total", "friccao_operacional"],
      irrelevant: ["micro_ganhos_sem_reducao_de_esforco"],
    };
  }
  return {
    relevant: ["tradeoff_principal"],
    irrelevant: [],
  };
}

export function runLogicalDiscernmentEngine(input: LogicalDiscernmentInput): LogicalDiscernmentResult {
  const flags: string[] = ["logical_discernment_started"];

  if (isLowImpactTurn(input)) {
    flags.push("low_impact_turn_detected");
    const frame = buildLogicalFrame({
      primaryGoal: null,
      secondaryGoals: [],
      dominantPrinciple: "unknown",
      constraints: [],
      realWorldConditions: [],
      relevantCosts: [],
      irrelevantCosts: [],
      feasibleActions: [],
      rejectedActions: [],
      recommendedAction: null,
      recommendationReason: null,
      confidence: 0.2,
    });
    return { frame, score: 0.2, flags };
  }

  if (isAbstractNonPracticalTurn(input)) {
    flags.push("abstract_non_practical_turn_detected");
    const frame = buildLogicalFrame({
      primaryGoal: null,
      secondaryGoals: [],
      dominantPrinciple: "unknown",
      constraints: [],
      realWorldConditions: [],
      relevantCosts: [],
      irrelevantCosts: [],
      feasibleActions: [],
      rejectedActions: [],
      recommendedAction: null,
      recommendationReason: null,
      confidence: 0.32,
    });
    return { frame, score: frame.confidence, flags };
  }

  const principle = detectDominantPrinciple(input);
  flags.push("dominant_principle_detected");

  const goal = extractRealGoal(input, principle.dominantPrinciple);
  const secondary = extractSecondaryGoals(input);
  const constraints = mapConstraints(input);
  const conditions = extractRealWorldConditions(input);

  const candidates = proposeCandidateActions(input, principle.dominantPrinciple);
  const feasibility = evaluateFeasibility({
    candidates,
    frameSeed: {
      constraints: constraints.constraints,
      primaryGoal: goal.primaryGoal,
    },
  });

  const costs = inferRelevantAndIrrelevantCosts(principle.dominantPrinciple);
  const enrichedFeasible = feasibility.feasibleActions.map((action) => {
    const estimate = estimateMarginalCost({
      action,
      dominantPrinciple: principle.dominantPrinciple,
    });
    return {
      ...action,
      estimatedCost: estimate.estimatedCost,
      estimatedMarginalCost: estimate.estimatedMarginalCost,
    };
  });

  const recommendation = selectRecommendedAction(enrichedFeasible, principle.dominantPrinciple);

  const confidence = clamp01(
    (principle.confidence * 0.34) +
    (goal.confidence * 0.24) +
    (Math.min(1, enrichedFeasible.length / 3) * 0.2) +
    (Math.min(1, constraints.constraints.length / 4) * 0.12) +
    (Math.min(1, conditions.conditions.length / 4) * 0.1),
  );

  const frame = buildLogicalFrame({
    primaryGoal: goal.primaryGoal,
    secondaryGoals: secondary.goals,
    dominantPrinciple: principle.dominantPrinciple,
    constraints: constraints.constraints,
    realWorldConditions: conditions.conditions,
    relevantCosts: costs.relevant,
    irrelevantCosts: costs.irrelevant,
    feasibleActions: enrichedFeasible,
    rejectedActions: feasibility.rejectedActions,
    recommendedAction: recommendation.recommendedAction,
    recommendationReason: recommendation.recommendationReason,
    confidence,
  });

  flags.push("logical_frame_built");
  if (frame.shouldAffectRouting || frame.shouldAffectRetrieval) {
    flags.push("logical_routing_bias_applied");
  }

  return {
    frame,
    score: frame.confidence,
    flags,
  };
}
