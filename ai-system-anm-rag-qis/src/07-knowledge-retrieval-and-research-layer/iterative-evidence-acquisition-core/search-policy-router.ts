/**
 * Responsabilidade do arquivo:
 * - Traduzir demanda epistêmica/razao em politica operacional de aquisicao.
 * - Definir profundidade, budget, necessidade de web, confirmacao e contraste.
 * - Manter regra de parada por suficiencia com custo controlado.
 */
import { clampConfidence } from "../../shared/utils/confidence-utils";
import { buildRetrievalOrder, getRequiredRetrievalOrder } from "./retrieval-order-manager";
import type { IterativeAcquisitionPolicy, IterativeAcquisitionRequest } from "./iterative-acquisition-types";

function clamp01(value: number): number {
  return clampConfidence(value);
}

function resolveDefaultBudget(query: string, factualNeedLevel: number, conflictSensitivity: number) {
  const baseCalls = query.length > 160 ? 28 : 20;
  const factualBoost = Math.round(factualNeedLevel * 8);
  const conflictBoost = Math.round(conflictSensitivity * 4);
  const maxCalls = Math.max(8, Math.min(48, baseCalls + factualBoost + conflictBoost));

  return {
    maxCalls,
    maxRounds: 4,
    timeoutMs: 12_000,
    retries: 1,
    perRoundCallCap: Math.max(3, Math.ceil(maxCalls / 4)),
    providerCap: 3,
  };
}

export function routeIterativeSearchPolicy(request: IterativeAcquisitionRequest): IterativeAcquisitionPolicy {
  const profile = request.intentProfile;
  const factualNeed = clamp01(profile.factualNeedLevel);
  const freshnessNeed = clamp01(profile.freshnessNeed);
  const authorityNeed = clamp01(profile.sourceAuthorityRequirement);
  const ambiguityTolerance = clamp01(profile.ambiguityTolerance);
  const conflictSensitivity = clamp01(profile.conflictSensitivity);
  const corroborationNeed = clamp01(profile.requiredCorroborationLevel);
  const factualTask = `${profile.taskType || ""}`.toLowerCase() === "factual_lookup";
  const factualDemand = factualTask || factualNeed >= 0.55 || freshnessNeed >= 0.55;

  const defaults = resolveDefaultBudget(request.query, factualNeed, conflictSensitivity);
  const hintedBudget = request.policyHint?.searchBudget;
  const minRoundsFloor = factualDemand ? 3 : 2;
  const budget = {
    maxCalls: Math.max(6, hintedBudget?.maxCalls ?? defaults.maxCalls),
    maxRounds: Math.max(minRoundsFloor, Math.min(4, hintedBudget?.maxRounds ?? defaults.maxRounds)),
    timeoutMs: Math.max(2_000, hintedBudget?.timeoutMs ?? defaults.timeoutMs),
    retries: Math.max(0, Math.min(2, hintedBudget?.retries ?? defaults.retries)),
    perRoundCallCap: Math.max(factualDemand ? 8 : 6, hintedBudget?.perRoundCallCap ?? defaults.perRoundCallCap),
    providerCap: Math.max(1, Math.min(5, hintedBudget?.providerCap ?? defaults.providerCap)),
  };

  const defaultOrder = getRequiredRetrievalOrder();
  const routedOrder = buildRetrievalOrder(request.policyHint?.order || defaultOrder);
  const enableWeb = request.policyHint?.enableWeb ?? (factualDemand || authorityNeed >= 0.48);
  const enableConfirm = request.policyHint?.enableConfirmatoryRound ?? (corroborationNeed >= 0.35);
  const enableContrast = request.policyHint?.enableContrastiveRound ?? (conflictSensitivity >= 0.3);

  const sanitizedOrder = routedOrder.filter((stage) => {
    if (!enableWeb && (stage === "web_multi_provider" || stage === "confirmatory_round" || stage === "contrastive_round")) {
      return false;
    }
    if (!enableConfirm && stage === "confirmatory_round") return false;
    if (!enableContrast && stage === "contrastive_round") return false;
    return true;
  });

  const computedSufficiency =
    request.policyHint?.minSufficiencyToStop ??
    (0.52 + (factualNeed * 0.18) + (authorityNeed * 0.08) + ((1 - ambiguityTolerance) * 0.06));
  const sufficiencyFloor = factualDemand ? 0.66 : 0.35;
  const minSufficiencyToStop = Math.max(
    sufficiencyFloor,
    Math.min(0.92, computedSufficiency),
  );

  return {
    retrievalDepth: Math.max(
      1,
      Math.min(4, Math.round(request.policyHint?.retrievalDepth ?? (1 + (factualNeed * 2.4) + (corroborationNeed * 1.2)))),
    ),
    searchBudget: budget,
    minSufficiencyToStop,
    order: sanitizedOrder.length ? sanitizedOrder : defaultOrder.slice(0, 6),
    enableWeb,
    enableConfirmatoryRound: enableConfirm && enableWeb,
    enableContrastiveRound: enableContrast && enableWeb,
    preferredWebProviders: request.policyHint?.preferredWebProviders?.length
      ? [...new Set(request.policyHint.preferredWebProviders)]
      : ["wikipedia_api", "duckduckgo_html", "bing_html"],
  };
}
