import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { runTruthCollapse } from "./collapse-and-truth-core/truth-collapse-engine";
import { extractEvidenceHints, generateHypotheses } from "./hypothesis-superposition-core/hypothesis-generator";
import { evidenceResonanceWeigher } from "./probabilistic-resonance-core/evidence-resonance-weigher";
import { memoryResonanceWeigher } from "./probabilistic-resonance-core/memory-resonance-weigher";
import { contextualPriorAdjuster } from "./probabilistic-resonance-core/contextual-prior-adjuster";
import { hypothesisWeightEngine } from "./probabilistic-resonance-core/hypothesis-weight-engine";
import { coherenceCompetitionEngine } from "./hypothesis-interference-core/coherence-competition-engine";
import { mutualReinforcementDetector } from "./hypothesis-interference-core/mutual-reinforcement-detector";
import { contradictionInterference } from "./hypothesis-interference-core/contradiction-interference";
import { semanticCancellationEngine } from "./hypothesis-interference-core/semantic-cancellation-engine";
import { lowValidityPruner } from "./hypothesis-interference-core/low-validity-pruner";
import { semanticProbabilityDistributor } from "./probabilistic-resonance-core/semantic-probability-distributor";
import { convergenceMapper } from "./convergence-core/convergence-mapper";
import { dominantTrajectorySelector } from "./convergence-core/dominant-trajectory-selector";
import { hypothesisFusionEngine } from "./convergence-core/hypothesis-fusion-engine";
import { multiHypothesisSynthesis } from "./convergence-core/multi-hypothesis-synthesis";
import { compositeTruthBuilder } from "./convergence-core/composite-truth-builder";
import { handoffQuantumToReflective } from "./quantum-to-reflective-bridge";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export async function runQuantumLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const evidenceHints = extractEvidenceHints(state.retrievedEvidence);
  const baseHypotheses = generateHypotheses(
    state.normalizedMessage,
    evidenceHints,
    state.retrievedSources.map((source) => source.url),
  );

  const regulatory = state.memorySnapshot.regulatoryState;
  const nodular = state.memorySnapshot.nodularState;
  const runtimeModules = state.memorySnapshot.legacyRuntimeModules || {};
  const runtimeTopModules = state.memorySnapshot.legacyRuntimeTopModules || [];
  const runtimeBoost = clamp01(
    ((runtimeModules.memory_manager || 0) * 0.22) +
    ((runtimeModules.ram_cortex || 0) * 0.16) +
    ((runtimeModules.global_attention || 0) * 0.16) +
    ((runtimeModules.working_memory || 0) * 0.16),
  );
  const memorySignal = Math.round(
    (state.memorySnapshot.selectedRecordIds.length || state.memorySnapshot.records.length) +
    (nodular.attention * 5) +
    (nodular.priming * 3) +
    (runtimeBoost * 6),
  );
  const evidenceWeights = evidenceResonanceWeigher({
    hypotheses: baseHypotheses,
    evidenceHints,
  });
  const memoryWeights = memoryResonanceWeigher({
    hypotheses: baseHypotheses,
    memorySignal,
  });
  const contextualPriors = contextualPriorAdjuster({
    hypotheses: baseHypotheses,
    ambiguity: state.complexityProfile.ambiguity,
  });
  const weighted = hypothesisWeightEngine({
    hypotheses: baseHypotheses,
    evidenceWeights: evidenceWeights.weights,
    memoryWeights: memoryWeights.weights,
    contextualPriors: contextualPriors.priors,
  });

  const coherence = coherenceCompetitionEngine({ hypotheses: weighted.hypotheses });
  const reinforced = mutualReinforcementDetector({ hypotheses: coherence.hypotheses });
  const contradictionAdjusted = contradictionInterference({ hypotheses: reinforced.hypotheses });
  const cancellationAdjusted = semanticCancellationEngine({ hypotheses: contradictionAdjusted.hypotheses });
  const pruned = lowValidityPruner({
    hypotheses: cancellationAdjusted.hypotheses,
    minWeight: 0.12,
  });

  const distribution = semanticProbabilityDistributor({ hypotheses: pruned.hypotheses });
  const withNormalizedWeights = pruned.hypotheses.map((hypothesis) => ({
    ...hypothesis,
    weight: distribution.normalized[hypothesis.id] ?? hypothesis.weight,
  }));

  const convergence = convergenceMapper({ hypotheses: withNormalizedWeights });
  const dominant = dominantTrajectorySelector({ ordered: convergence.ordered });
  const fusion = hypothesisFusionEngine({ ordered: convergence.ordered });
  const synthesis = multiHypothesisSynthesis({ ordered: convergence.ordered, maxItems: 3 });
  const composite = compositeTruthBuilder({
    dominant: dominant.dominant,
    fusedSummary: fusion.fusedSummary,
    synthesisSummary: synthesis.synthesisSummary,
    convergenceScore: convergence.convergenceScore,
  });

  const collapse = runTruthCollapse({
    hypotheses: convergence.ordered,
    ambiguity: Math.max(0, state.complexityProfile.ambiguity - (composite.convergence.confidence * 0.18)),
  });

  state.hypothesisSet = convergence.ordered.map((row) => ({
    id: row.id,
    claim: row.claim,
    weight: collapse.normalizedWeights[row.id] ?? row.weight,
    supportingSources: row.supportingSources,
    contradictorySources: row.contradictorySources,
  }));
  state.quantumWeights = collapse.normalizedWeights;
  state.quantumState = {
    hypotheses: state.hypothesisSet,
    normalizedWeights: collapse.normalizedWeights,
    converged: composite.convergence.converged || collapse.converged,
  };
  state.collapsedTruth = {
    ...collapse.collapsedTruth,
    summary: composite.convergence.fusedSummary || composite.convergence.synthesisSummary || collapse.collapsedTruth.summary,
    dominantHypothesisId: composite.convergence.dominantId || collapse.collapsedTruth.dominantHypothesisId,
    uncertainty: Number(
      clamp01(
        (collapse.collapsedTruth.uncertainty * 0.82) +
        (regulatory.stressLoad * 0.12) -
        (nodular.attention * 0.06),
      ).toFixed(4),
    ),
  };
  state.epistemicStatus = state.collapsedTruth.status;
  state.confidenceScores.epistemic = Number(
    clamp01(
      (collapse.confidence * 0.88) +
      (runtimeBoost * 0.08) -
      (Math.max(0, regulatory.stressLoad - regulatory.contextStability) * 0.04),
    ).toFixed(4),
  );

  state.trace.push(
    makeTraceEvent({
      layer: "quantum",
      action: "hypothesis_collapsed",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `dominant=${state.collapsedTruth.dominantHypothesisId || "none"}; confidence=${state.confidenceScores.epistemic}; converged=${state.quantumState.converged}; ` +
        `memorySignal=${memorySignal}; runtimeBoost=${runtimeBoost.toFixed(2)}; stress=${regulatory.stressLoad.toFixed(2)}; ` +
        `topModules=${runtimeTopModules.slice(0, 2).join(",")}`,
    }),
  );
  return handoffQuantumToReflective(state);
}
