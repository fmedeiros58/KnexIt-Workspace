import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { runClaimCheck } from "./factual-validator/claim-check";
import { runSourceAlignmentCheck } from "./factual-validator/source-alignment-check";
import { detectUnsupportedStatements } from "./factual-validator/unsupported-statement-detector";
import { detectHallucinationRisk } from "./factual-validator/hallucination-risk-detector";
import { validateHypothesisTrace } from "./factual-validator/hypothesis-trace-validator";
import { runPrivacyGuard } from "./policy-validator/privacy-guard";
import { runRestrictedContentFilter } from "./policy-validator/restricted-content-filter";
import { runSafetyOutputCheck } from "./policy-validator/safety-output-check";
import { runSensitiveContentOutputCheck } from "./policy-validator/sensitive-content-output-check";
import { checkBrokenParagraphs } from "./structural-validator/broken-paragraph-check";
import { checkCompletion } from "./structural-validator/completion-check";
import { checkEmptySections } from "./structural-validator/empty-section-check";
import { checkSequenceIntegrity } from "./structural-validator/sequence-integrity-check";
import { checkTruncation } from "./structural-validator/truncation-check";
import { scoreCoherence } from "./quality-scorer/coherence-score";
import { scoreDensity } from "./quality-scorer/density-score";
import { scoreEpistemicConfidence } from "./quality-scorer/epistemic-confidence-score";
import { scoreFluency } from "./quality-scorer/fluency-score";
import { scoreRelevance } from "./quality-scorer/relevance-score";
import { decideAcceptOrRetry } from "./quality-scorer/final-accept-retry-decision";
import { handoffValidationToPresentation } from "./validation-to-presentation-bridge";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export async function runValidationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  const claim = runClaimCheck(state.structuredResponse);
  const sourceAlignment = runSourceAlignmentCheck({
    text: state.structuredResponse,
    sourceCount: state.retrievedSources.length,
  });
  const unsupported = detectUnsupportedStatements({
    text: state.structuredResponse,
    sourceCount: state.retrievedSources.length,
  });
  const traceValidation = validateHypothesisTrace({
    dominantHypothesisId: state.collapsedTruth.dominantHypothesisId,
    hypothesisIds: state.hypothesisSet.map((item) => item.id),
  });
  const hallucination = detectHallucinationRisk({
    uncertainty: state.collapsedTruth.uncertainty,
    sourceCount: state.retrievedSources.length,
    hypothesisCount: state.hypothesisSet.length,
  });

  const privacy = runPrivacyGuard(state.structuredResponse);
  const restricted = runRestrictedContentFilter(state.structuredResponse);
  const safety = runSafetyOutputCheck(state.structuredResponse);
  const sensitive = runSensitiveContentOutputCheck(state.structuredResponse);

  const brokenParagraphs = checkBrokenParagraphs(state.structuredResponse);
  const completion = checkCompletion(state.structuredResponse);
  const emptySections = checkEmptySections(state.structuredResponse);
  const sequence = checkSequenceIntegrity(state.structuredResponse);
  const truncation = checkTruncation(state.structuredResponse);

  const paragraphCount = state.structuredResponse.split(/\n{2,}/g).filter(Boolean).length;
  const baseCoherence = scoreCoherence({
    assumptions: state.reflectiveNotes.assumptions.length,
    tensions: state.reflectiveNotes.tensions.length,
    paragraphCount,
  });
  const regulatory = state.memorySnapshot.regulatoryState;
  const nodular = state.memorySnapshot.nodularState;
  const runtimeModules = state.memorySnapshot.legacyRuntimeModules || {};
  const runtimeOverclaimSignal = clamp01(
    ((runtimeModules.memory_manager || 0) * 0.16) +
    ((runtimeModules.memory_policies || 0) * 0.12) +
    ((runtimeModules.regulatory_state || 0) * 0.18),
  );
  const memoryValidationRisk = clamp01(
    (regulatory.stressLoad * 0.44) +
    (Math.max(0, regulatory.stressLoad - regulatory.contextStability) * 0.3) +
    (runtimeOverclaimSignal * 0.26),
  );
  const coherence = Number(
    clamp01(
      (baseCoherence * 0.9) +
      (nodular.attention * 0.08) -
      (memoryValidationRisk * 0.12),
    ).toFixed(4),
  );
  const density = scoreDensity(state.structuredResponse);
  const baseEpistemic = scoreEpistemicConfidence({
    uncertainty: state.collapsedTruth.uncertainty,
    sourceCount: state.retrievedSources.length,
    risk: hallucination.risk,
  });
  const epistemic = Number(
    clamp01(
      (baseEpistemic * 0.9) +
      (nodular.value * 0.08) -
      (memoryValidationRisk * 0.14),
    ).toFixed(4),
  );
  const fluency = scoreFluency(state.structuredResponse);
  const relevance = scoreRelevance({ message: state.normalizedMessage, answer: state.structuredResponse });
  const quality = decideAcceptOrRetry({
    coherence,
    density,
    epistemic,
    fluency,
    relevance: Number(clamp01(relevance - (memoryValidationRisk * 0.06)).toFixed(4)),
  });
  const memoryIssues = [
    ...(memoryValidationRisk >= 0.62 ? ["memory_regulatory_high_risk"] : []),
    ...(regulatory.blockStructuralConsolidation ? ["memory_regulatory_consolidation_blocked"] : []),
    ...(runtimeOverclaimSignal >= 0.6 ? ["memory_runtime_overclaim_signal"] : []),
  ];

  state.validationReport = {
    factual: {
      ok: claim.ok && sourceAlignment.ok && unsupported.ok && traceValidation.ok && hallucination.risk < 0.62 && memoryValidationRisk < 0.78,
      issues: [
        ...claim.issues,
        ...sourceAlignment.issues,
        ...unsupported.issues,
        ...traceValidation.issues,
        ...hallucination.issues,
        ...memoryIssues,
      ],
    },
    policy: {
      ok: privacy.ok && restricted.ok && safety.ok && sensitive.ok,
      issues: [...privacy.issues, ...restricted.issues, ...safety.issues, ...sensitive.issues],
    },
    structure: {
      ok: brokenParagraphs.ok && completion.ok && emptySections.ok && sequence.ok && truncation.ok,
      issues: [
        ...brokenParagraphs.issues,
        ...completion.issues,
        ...emptySections.issues,
        ...sequence.issues,
        ...truncation.issues,
      ],
    },
    quality,
  };

  state.confidenceScores.coherence = coherence;
  state.confidenceScores.final = quality.score;
  state.trace.push(
    makeTraceEvent({
      layer: "validation",
      action: "multi_layer_validation_complete",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `factual=${state.validationReport.factual.ok}; policy=${state.validationReport.policy.ok}; structure=${state.validationReport.structure.ok}; ` +
        `decision=${quality.decision}; memoryRisk=${memoryValidationRisk.toFixed(2)}; stress=${regulatory.stressLoad.toFixed(2)}; runtimeOverclaim=${runtimeOverclaimSignal.toFixed(2)}`,
    }),
  );
  return handoffValidationToPresentation(state);
}
