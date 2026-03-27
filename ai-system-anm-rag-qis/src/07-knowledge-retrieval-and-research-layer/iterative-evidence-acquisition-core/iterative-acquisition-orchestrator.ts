/**
 * Responsabilidade do arquivo:
 * - Orquestrar aquisicao iterativa de evidencia em rodadas.
 * - Aplicar ordem progressiva, condicionamento, ranking e preparo de conflitos.
 * - Entregar evidence bundle estruturado para epistêmico/reasoning.
 */
import { meanConfidence } from "../../shared/utils/confidence-utils";
import { decomposeQuery } from "./query-decomposition-engine";
import { expandQueriesByRound } from "./semantic-query-expander";
import {
  canExecuteStage,
  createBudgetRuntimeState,
  isTimeoutExceeded,
  registerExecution,
  shouldStopByRedundancy,
} from "./acquisition-budget-regulator";
import { runMultiSourceSearchCoordinator } from "./multi-source-search-coordinator";
import { conditionEvidenceItems } from "./evidence-conditioning-engine";
import { rankConditionedEvidence } from "./evidence-ranking-engine";
import { analyzeEvidenceConvergence } from "./evidence-convergence-analyzer";
import { prepareEvidenceConflicts } from "./evidence-conflict-preparer";
import { routeIterativeSearchPolicy } from "./search-policy-router";
import { buildSearchRoundPlan } from "./search-round-manager";
import type {
  EvidenceConflictCandidate,
  EvidenceConvergenceCluster,
  EvidenceItem,
  IterativeAcquisitionRequest,
  IterativeEvidenceBundle,
  SearchRoundExecution,
} from "./iterative-acquisition-types";

function isGroundedEvidenceItem(item: EvidenceItem): boolean {
  const url = `${item.url || ""}`.trim().toLowerCase();
  if (!url) return false;
  if (item.sourceType === "web") return true;
  if (item.provider.includes("vector_store")) return true;
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  if (url.startsWith("memory://") || url.startsWith("internal://") || url.startsWith("about:blank")) return false;
  return item.sourceType === "docs" || item.sourceType === "rag" || item.sourceType === "vector";
}

function resolveSufficiencyEstimate(
  ranked: EvidenceItem[],
  convergence: EvidenceConvergenceCluster[],
  conflicts: EvidenceConflictCandidate[],
): number {
  if (!ranked.length) return 0;
  const topConfidence = meanConfidence(ranked.slice(0, 6).map((row) => row.retrievalScore));
  const convergenceBoost = Math.min(0.2, convergence.reduce((sum, row) => sum + (row.supportCount * 0.02), 0));
  const conflictPenalty = Math.min(0.22, conflicts.reduce((sum, row) => sum + (row.sensitivity * 0.08), 0));
  const sourceTypeCount = new Set(ranked.slice(0, 12).map((row) => row.sourceType)).size;
  const sourceDiversityBoost = Math.min(0.08, sourceTypeCount * 0.014);
  const hasGroundedSource = ranked.some(isGroundedEvidenceItem);
  const groundingAdjustment = hasGroundedSource ? 0.08 : -0.14;
  const volumeBoost = Math.min(0.06, ranked.length * 0.009);
  return Math.max(0, Math.min(1, topConfidence + convergenceBoost + sourceDiversityBoost + volumeBoost + groundingAdjustment - conflictPenalty));
}

function resolveFreshnessAssessment(ranked: EvidenceItem[]): number {
  if (!ranked.length) return 0;
  return meanConfidence(ranked.slice(0, 8).map((row) => row.freshnessScore));
}

function resolveEpistemicPosture(
  sufficiency: number,
  conflicts: EvidenceConflictCandidate[],
): IterativeEvidenceBundle["recommendedEpistemicPosture"] {
  if (conflicts.some((row) => row.sensitivity >= 0.7)) return "cautious";
  if (sufficiency >= 0.72) return "strict";
  if (sufficiency >= 0.52) return "balanced";
  return "cautious";
}

function resolveReasoningUsage(sufficiency: number): IterativeEvidenceBundle["recommendedReasoningUsage"] {
  if (sufficiency >= 0.72) return "direct";
  if (sufficiency >= 0.48) return "augmented";
  return "defer";
}

function collectSourcesConsulted(items: EvidenceItem[]) {
  const map = new Map<string, { sourceType: EvidenceItem["sourceType"]; provider: string; count: number }>();
  for (const item of items) {
    const key = `${item.sourceType}:${item.provider}`;
    if (!map.has(key)) {
      map.set(key, {
        sourceType: item.sourceType,
        provider: item.provider,
        count: 0,
      });
    }
    map.get(key)!.count += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function hasGroundedEvidence(items: EvidenceItem[]): boolean {
  return items.some(isGroundedEvidenceItem);
}

function resolveMinRoundsBeforeStop(
  request: IterativeAcquisitionRequest,
  policy: ReturnType<typeof routeIterativeSearchPolicy>,
): number {
  const factualDemand = request.intentProfile.factualNeedLevel >= 0.55 || request.intentProfile.freshnessNeed >= 0.55;
  if (factualDemand && policy.enableWeb) return Math.min(3, Math.max(1, policy.searchBudget.maxRounds));
  if (factualDemand) return Math.min(2, Math.max(1, policy.searchBudget.maxRounds));
  return 1;
}

export async function runIterativeAcquisitionOrchestrator(
  request: IterativeAcquisitionRequest,
): Promise<IterativeEvidenceBundle> {
  const policy = routeIterativeSearchPolicy(request);
  const decomposition = decomposeQuery(request.query);
  const rounds = buildSearchRoundPlan(policy);
  const runtime = createBudgetRuntimeState();
  const minRoundsBeforeStop = resolveMinRoundsBeforeStop(request, policy);

  const allEvidence: EvidenceItem[] = [];
  const executedRounds: SearchRoundExecution[] = [];
  let stopReason: IterativeEvidenceBundle["stopReason"] = "no_signal";

  for (const roundPlan of rounds) {
    let roundCalls = 0;
    const beforeCount = allEvidence.length;
    const queries = expandQueriesByRound(decomposition, roundPlan.round, Math.max(4, policy.retrievalDepth * 4));

    for (const stage of roundPlan.stages) {
      // Cada estagio faz uma chamada coordenada unica (internamente pode consolidar multiplas variantes).
      const estimatedCalls = 1;
      if (!canExecuteStage(policy, runtime, roundPlan.round, estimatedCalls)) {
        stopReason = "budget_exhausted";
        break;
      }
      if (isTimeoutExceeded(policy, runtime)) {
        stopReason = "budget_exhausted";
        break;
      }

      const items = await runMultiSourceSearchCoordinator({
        request,
        policy,
        stage,
        round: roundPlan.round,
        queries,
        topK: Math.max(4, policy.retrievalDepth * 3),
      });

      allEvidence.push(...items);
      registerExecution(runtime, roundPlan.round, estimatedCalls);
      roundCalls += estimatedCalls;
    }

    const conditionedRound = conditionEvidenceItems(allEvidence);
    const rankedRound = rankConditionedEvidence(conditionedRound);
    const convergenceRound = analyzeEvidenceConvergence(rankedRound);
    const conflictsRound = prepareEvidenceConflicts(rankedRound);
    const sufficiencyRound = resolveSufficiencyEstimate(rankedRound, convergenceRound, conflictsRound);

    const roundExecution: SearchRoundExecution = {
      round: roundPlan.round,
      objective: roundPlan.objective,
      stages: roundPlan.stages,
      callsUsed: roundCalls,
      evidenceAdded: Math.max(0, conditionedRound.length - beforeCount),
    };
    executedRounds.push(roundExecution);

    const executedRoundsCount = executedRounds.length;
    const canStopBySufficiency =
      sufficiencyRound >= policy.minSufficiencyToStop &&
      executedRoundsCount >= minRoundsBeforeStop &&
      (hasGroundedEvidence(rankedRound) || !policy.enableWeb);
    if (canStopBySufficiency) {
      stopReason = "sufficiency_reached";
      break;
    }
    if (shouldStopByRedundancy(executedRounds, roundExecution.evidenceAdded)) {
      stopReason = "redundancy";
      break;
    }
    if (stopReason === "budget_exhausted") break;
  }

  const conditioned = conditionEvidenceItems(allEvidence);
  const ranked = rankConditionedEvidence(conditioned);
  const convergence = analyzeEvidenceConvergence(ranked);
  const conflicts = prepareEvidenceConflicts(ranked);
  const sufficiency = resolveSufficiencyEstimate(ranked, convergence, conflicts);
  const freshness = resolveFreshnessAssessment(ranked);

  if (!stopReason || stopReason === "no_signal") {
    if (!ranked.length) {
      stopReason = "no_signal";
    } else if (sufficiency >= policy.minSufficiencyToStop) {
      stopReason = "sufficiency_reached";
    } else {
      stopReason = "budget_exhausted";
    }
  }

  const unresolvedGaps: string[] = [];
  if (!ranked.length) unresolvedGaps.push("Nenhuma evidencia util foi encontrada nas rodadas executadas.");
  if (sufficiency < policy.minSufficiencyToStop) {
    unresolvedGaps.push("Suficiencia abaixo do limiar epistêmico definido para a demanda atual.");
  }
  if (conflicts.some((row) => row.sensitivity >= 0.7)) {
    unresolvedGaps.push("Conflitos sensiveis detectados; requer adjudicacao epistêmica.");
  }

  return {
    requestId: request.requestId,
    queryIntentProfile: request.intentProfile,
    acquisitionPolicy: policy,
    executedRounds,
    sourcesConsulted: collectSourcesConsulted(ranked),
    evidenceItems: conditioned,
    rankedEvidence: ranked,
    convergenceClusters: convergence,
    conflictCandidates: conflicts,
    unresolvedGaps,
    sufficiencyEstimate: sufficiency,
    freshnessAssessment: freshness,
    recommendedEpistemicPosture: resolveEpistemicPosture(sufficiency, conflicts),
    recommendedReasoningUsage: resolveReasoningUsage(sufficiency),
    stopReason,
  };
}
