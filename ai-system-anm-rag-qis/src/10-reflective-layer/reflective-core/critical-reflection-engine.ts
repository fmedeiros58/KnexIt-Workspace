import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { checkAssumptions } from "./assumption-checker";
import { reviewContradictions } from "./contradiction-reviewer";
import { mapLimitations } from "./limitation-mapper";
import { analyzeTradeoffs } from "./tradeoff-analyzer";
import { buildCriticalObservations } from "./critical-observation-builder";
import { buildEpistemicCautions } from "./epistemic-caution-engine";
import { balancePositiveNegative } from "./positive-negative-balancer";
import { evidenceGapReview } from "../reflective-review-core/evidence-gap-review";
import { internalConsistencyReview } from "../reflective-review-core/internal-consistency-review";
import { contextualTensionReview } from "../reflective-review-core/contextual-tension-review";
import { overclaimDetector } from "../reflective-review-core/overclaim-detector";
import { reflectiveWeightAdjuster } from "../reflective-review-core/reflective-weight-adjuster";
import { criticalNotesBuilder } from "../reflective-output-core/critical-notes-builder";
import { caveatPrioritizer } from "../reflective-output-core/caveat-prioritizer";
import { reflectiveSummaryBuilder } from "../reflective-output-core/reflective-summary-builder";

export function buildCriticalReflection(state: ProcessingState) {
  const assumptions = checkAssumptions(state);
  const contradictions = reviewContradictions(state);
  const limitations = mapLimitations(state);
  const tradeoffs = analyzeTradeoffs(state);
  const cautions = buildEpistemicCautions(state);
  const memoryAssumptions = state.memorySnapshot.globalNamespaces.metacognitive
    .slice(0, 2)
    .map((item) => `Memoria metacognitiva sugere pressuposto: ${item}`);
  const memoryProspectiveTensions = state.memorySnapshot.globalNamespaces.prospective
    .slice(0, 2)
    .map((item) => `Tensao prospectiva detectada: ${item}`);
  const runtimeTopModules = state.memorySnapshot.legacyRuntimeTopModules || [];
  const regulatory = state.memorySnapshot.regulatoryState;

  const evidenceGap = evidenceGapReview({
    evidenceCount: state.retrievedEvidence.length,
    sourceCount: state.retrievedSources.length,
    claimCount: Math.max(1, state.hypothesisSet.length),
  });
  const consistency = internalConsistencyReview({
    collapsedSummary: state.collapsedTruth.summary,
    caveats: [...cautions, ...limitations, ...contradictions],
    implications: state.inferentialMap.implications,
  });
  const tensionReview = contextualTensionReview({
    activeContext: state.activeContext,
    activeConstraints: state.activeConstraints,
  });
  const overclaim = overclaimDetector({
    text: state.collapsedTruth.summary,
    uncertainty: state.collapsedTruth.uncertainty,
  });
  const weight = reflectiveWeightAdjuster({
    gapScore: evidenceGap.gapScore,
    tensionScore: tensionReview.tensionScore,
    overclaimRisk: overclaim.riskScore,
    consistencyScore: consistency.consistencyScore,
  });

  const observations = buildCriticalObservations({
    assumptions,
    contradictions,
    limitations,
    tradeoffs,
  });
  const balanced = balancePositiveNegative(observations);
  const notes = criticalNotesBuilder({
    assumptions,
    contradictions,
    limitations,
    tensions: [...balanced.risks, ...tensionReview.tensions],
    overclaims: overclaim.overclaims,
  });

  const baseCaveats = [
    ...cautions,
    ...limitations,
    ...contradictions,
    ...evidenceGap.gaps,
    ...consistency.consistencyIssues,
    ...notes.notes,
  ];
  const prioritizedCaveats = caveatPrioritizer({
    caveats: baseCaveats,
    reflectionWeight: weight.reflectionWeight,
  });
  const reflectiveSummary = reflectiveSummaryBuilder({
    topAssumption: assumptions[0],
    topCaveat: prioritizedCaveats.prioritized[0],
    reflectionPriority: weight.priority,
  });
  const memoryRegulatoryCaveat =
    regulatory.stressLoad >= 0.66
      ? `Memoria regulatoria em alerta (stress=${regulatory.stressLoad.toFixed(2)}; estabilidade=${regulatory.contextStability.toFixed(2)}).`
      : "";
  const runtimeCaveat =
    runtimeTopModules.length >= 2
      ? `Modulos de memoria ativos: ${runtimeTopModules.slice(0, 3).join(", ")}.`
      : "";

  return {
    assumptions: [...assumptions, ...memoryAssumptions].slice(0, 10),
    caveats: [...prioritizedCaveats.prioritized, memoryRegulatoryCaveat, runtimeCaveat, reflectiveSummary.summary].filter(Boolean).slice(0, 12),
    tensions: [...balanced.risks, ...tradeoffs, ...tensionReview.tensions, ...memoryProspectiveTensions].slice(0, 12),
    criticalCaveats: [...prioritizedCaveats.prioritized, ...overclaim.overclaims, memoryRegulatoryCaveat, runtimeCaveat, reflectiveSummary.summary]
      .filter(Boolean)
      .slice(0, 14),
  };
}
