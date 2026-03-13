import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { mapImplications } from "./implication-mapper";
import { projectConsequences } from "./consequence-projector";
import { expandScenarios } from "./scenario-expander";
import { estimatePracticalImpacts } from "./practical-impact-estimator";
import { detectLatentRelations } from "./latent-relation-detector";
import { buildDeductiveBridge } from "./deductive-bridge";
import { synthesizeInferentialMap } from "./inferential-synthesis";
import { downstreamEffectsMapper } from "../inferential-expansion-core/downstream-effects-mapper";
import { hiddenDependencyDetector } from "../inferential-expansion-core/hidden-dependency-detector";
import { secondOrderConsequenceEngine } from "../inferential-expansion-core/second-order-consequence-engine";
import { conditionalPathEstimator } from "../inferential-expansion-core/conditional-path-estimator";
import { probabilisticOutcomeBalancer } from "../inferential-expansion-core/probabilistic-outcome-balancer";
import { scenarioPrioritizer } from "../inferential-output-core/scenario-prioritizer";
import { implicationSummaryBuilder } from "../inferential-output-core/implication-summary-builder";
import { inferentialConfidenceScorer } from "../inferential-output-core/inferential-confidence-scorer";

export function runInferenceEngine(state: ProcessingState) {
  const implications = mapImplications(state);
  const consequences = projectConsequences(state);
  const scenarios = expandScenarios(state);
  const practicalImpacts = estimatePracticalImpacts(state);
  const latentRelations = detectLatentRelations(state);
  const deductiveLinks = buildDeductiveBridge(implications, consequences);

  const downstream = downstreamEffectsMapper({
    implications,
    scenarios,
  });
  const hiddenDeps = hiddenDependencyDetector({
    text: `${state.normalizedMessage} ${state.activeContext.join(" ")}`,
  });
  const secondOrder = secondOrderConsequenceEngine({
    consequences,
  });
  const conditionalPaths = conditionalPathEstimator({
    scenarios,
    uncertainty: state.collapsedTruth.uncertainty,
  });
  const prioritizedScenarios = scenarioPrioritizer({ scenarios });
  const balancedOutcomes = probabilisticOutcomeBalancer({
    outcomes: [...scenarios, ...conditionalPaths.paths],
    confidence: state.confidenceScores.epistemic || 0.45,
  });
  const implicationSummary = implicationSummaryBuilder({ implications });
  const inferentialConfidence = inferentialConfidenceScorer({
    implicationCount: implications.length,
    scenarioCount: prioritizedScenarios.prioritizedScenarios.length,
    secondOrderCount: secondOrder.secondOrderConsequences.length,
    uncertainty: state.collapsedTruth.uncertainty,
  });
  const memoryProspectiveScenarios = state.memorySnapshot.globalNamespaces.prospective
    .slice(0, 3)
    .map((item) => `Cenario orientado por memoria prospectiva: ${item}`);
  const memoryProceduralImplications = state.memorySnapshot.globalNamespaces.procedural
    .slice(0, 3)
    .map((item) => `Implicacao operacional por memoria procedural: ${item}`);
  const runtimeTop = state.memorySnapshot.legacyRuntimeTopModules || [];
  const nodular = state.memorySnapshot.nodularState;
  const regulatory = state.memorySnapshot.regulatoryState;

  const secondOrderEffects = [
    ...practicalImpacts,
    ...latentRelations,
    ...deductiveLinks,
    ...downstream.effects,
    ...hiddenDeps.dependencies,
    ...secondOrder.secondOrderConsequences,
    ...balancedOutcomes.balancedOutcomes,
    ...memoryProspectiveScenarios,
    ...memoryProceduralImplications,
    implicationSummary.summary,
    `Confianca inferencial: ${inferentialConfidence.confidence.toFixed(2)}`,
    `Memoria nodular: attention=${nodular.attention.toFixed(2)} priming=${nodular.priming.toFixed(2)} value=${nodular.value.toFixed(2)}`,
    `Memoria regulatoria: stress=${regulatory.stressLoad.toFixed(2)} stability=${regulatory.contextStability.toFixed(2)}`,
    ...(runtimeTop.length ? [`Modulos de memoria mais ativos: ${runtimeTop.slice(0, 3).join(", ")}`] : []),
  ];

  return synthesizeInferentialMap({
    implications: [...implications, ...memoryProceduralImplications].slice(0, 14),
    scenarios: [...prioritizedScenarios.prioritizedScenarios, ...memoryProspectiveScenarios].slice(0, 12),
    secondOrderEffects,
  });
}
