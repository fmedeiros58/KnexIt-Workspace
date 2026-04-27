/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17-validation-layer
 * Module: validation-layer-bridge
 * Responsibility: Execute structural, factual, policy and quality validation before presentation handoff.
 * Primary Inputs: ProcessingState, adaptive layer mode and validated response surfaces.
 * Primary Outputs: ValidationReport, validatedDraft and presentation handoff.
 * Upstream Dependencies: response structure, academic normalization, epistemic bridge, validation operators
 * Downstream Dependencies: presentation-layer
 * Invariants: Validation must not bypass the descending pipeline; it only hardens the outgoing surface.
 * Failure Modes: Missing evidence signals degrade to conservative acceptance thresholds and retry bias.
 * Audit Events: multi_layer_validation_complete
 * Notes: Adaptive orchestration modulates validation intensity, but semantic ownership remains in upstream layers.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveLayerModeFromState } from "../05-complexity-and-orchestration-layer/activation-policy/layer-mode-resolver";
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
import { resolveValidationProfile } from "./validation-profile-resolver";
import { runEpistemicValidationBridgeAdapter } from "../bridges/epistemic-validation.bridge";
import { buildFounderEpistemicInfluence } from "../12b-founder-influence-layer/founder-epistemic-bridge";
import { structuralValidator } from "./operators/structural-validator";
import { epistemicValidator } from "./operators/epistemic-validator";
import { confidenceChecker } from "./operators/confidence-checker";
import { checkConstraintCompliance } from "./operators/constraint-compliance-checker";
import { checkDialogicalBalance } from "./operators/dialogical-balance-checker";
import { detectContrarianOverreach } from "./operators/contrarian-overreach-detector";
import { validateResponseFormatFit } from "./operators/response-format-fit-validator";
import { checkSolutionCompleteness } from "./operators/solution-completeness-checker";
import { validateTaskModeFit } from "./operators/task-mode-fit-validator";
import { detectYesMan } from "./operators/yes-man-detector";
import { challengeFirstAnswer } from "../10-reflective-layer/operators/first-answer-challenge";
import { isCognitiveTaskType } from "../bridges/contracts/cognitive-task-type";
import type { TaskClassValidationReport } from "../bridges/contracts/validation-report";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export async function runValidationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const validationStage = state.executionArtifacts?.validationStage || "pre_presentation";
  const validationMode = resolveLayerModeFromState(state, "validation");
  const profile = resolveValidationProfile(state);
  const structuralPolicy = structuralValidator(state, validationMode);
  const epistemicPolicy = epistemicValidator(state, validationMode);
  const confidencePolicy = confidenceChecker(state, validationMode);
  const epistemicValidation = runEpistemicValidationBridgeAdapter(state);
  const founderEpistemicInfluence = buildFounderEpistemicInfluence();

  state.executionArtifacts.founderInfluence = {
    founderName: founderEpistemicInfluence.founderName,
    founderRole: state.executionArtifacts.founderInfluence?.founderRole || "fundador_epistemologico_da_leticia",
    identityWeight: state.executionArtifacts.founderInfluence?.identityWeight || 0,
    reasoningWeight: state.executionArtifacts.founderInfluence?.reasoningWeight || 0,
    epistemicWeight: founderEpistemicInfluence.epistemicWeight,
    identityInfluenceDirectives: [...(state.executionArtifacts.founderInfluence?.identityInfluenceDirectives || [])],
    reasoningInfluenceDirectives: [...(state.executionArtifacts.founderInfluence?.reasoningInfluenceDirectives || [])],
    validationInfluenceDirectives: [...founderEpistemicInfluence.validationInfluenceDirectives],
    existentialVectors: [...(state.executionArtifacts.founderInfluence?.existentialVectors || [])],
    epistemicVectors: [...new Set([...(state.executionArtifacts.founderInfluence?.epistemicVectors || []), ...founderEpistemicInfluence.epistemicVectors])],
    protectedGroundingFacts: [...new Set([...(state.executionArtifacts.founderInfluence?.protectedGroundingFacts || []), ...founderEpistemicInfluence.protectedGroundingFacts])],
  };

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
    (Math.max(0, regulatory.stressLoad - regulatory.contextStability) * 0.30) +
    (runtimeOverclaimSignal * 0.26),
  );

  let factualOk = true;
  let factualIssues: string[] = [];
  let epistemicBase = 0.85;
  const runDeepEpistemicChecks = profile !== "light" || epistemicPolicy.shouldRunClaimCheck;

  if (runDeepEpistemicChecks) {
    const claim = epistemicPolicy.shouldRunClaimCheck
      ? runClaimCheck(state.structuredResponse)
      : { ok: true, issues: [] as string[] };
    const sourceAlignment = epistemicPolicy.shouldRunSourceAlignment
      ? runSourceAlignmentCheck({
          text: state.structuredResponse,
          sourceCount: state.retrievedSources.length,
        })
      : { ok: true, issues: [] as string[] };
    const unsupported = epistemicPolicy.shouldRunUnsupportedStatementCheck
      ? detectUnsupportedStatements({
          text: state.structuredResponse,
          sourceCount: state.retrievedSources.length,
        })
      : { ok: true, issues: [] as string[] };
    const hallucination = detectHallucinationRisk({
      uncertainty: state.collapsedTruth.uncertainty,
      sourceCount: state.retrievedSources.length,
      hypothesisCount: state.hypothesisSet.length,
    });

    const traceValidation =
      epistemicPolicy.shouldRunHypothesisTrace
        ? validateHypothesisTrace({
            dominantHypothesisId: state.collapsedTruth.dominantHypothesisId,
            hypothesisIds: state.hypothesisSet.map((item) => item.id),
          })
        : { ok: true, issues: [] as string[] };

    factualOk =
      claim.ok &&
      sourceAlignment.ok &&
      unsupported.ok &&
      traceValidation.ok &&
      epistemicValidation.verdict.ok &&
      hallucination.risk < epistemicPolicy.maxHallucinationRisk &&
      memoryValidationRisk < (profile === "strict" ? 0.72 : 0.82);

    factualIssues = [
      ...claim.issues,
      ...sourceAlignment.issues,
      ...unsupported.issues,
      ...traceValidation.issues,
      ...epistemicValidation.verdict.issues,
      ...hallucination.issues,
      ...epistemicPolicy.rationale,
      ...(memoryValidationRisk >= 0.62 ? ["memory_regulatory_high_risk"] : []),
      ...(regulatory.blockStructuralConsolidation ? ["memory_regulatory_consolidation_blocked"] : []),
      ...(runtimeOverclaimSignal >= 0.6 ? ["memory_runtime_overclaim_signal"] : []),
    ];

    epistemicBase = scoreEpistemicConfidence({
      uncertainty: state.collapsedTruth.uncertainty,
      sourceCount: state.retrievedSources.length,
      risk: hallucination.risk,
    });
    epistemicBase = clamp01((epistemicBase * 0.72) + (epistemicValidation.verdict.score * 0.28));
  }

  const baseCoherence = scoreCoherence({
    assumptions: state.reflectiveNotes.assumptions.length,
    tensions: state.reflectiveNotes.tensions.length,
    paragraphCount,
  });

  const coherence = Number(
    clamp01(
      (baseCoherence * 0.90) +
      (nodular.attention * 0.08) -
      (memoryValidationRisk * 0.12),
    ).toFixed(4),
  );

  const density = scoreDensity(state.structuredResponse);
  const epistemic = Number(
    clamp01(
      (epistemicBase * 0.90) +
      (nodular.value * 0.08) -
      (memoryValidationRisk * 0.14),
    ).toFixed(4),
  );
  const fluency = scoreFluency(state.structuredResponse);
  const relevance = scoreRelevance({
    message: state.normalizedMessage || state.rawMessage,
    answer: state.structuredResponse,
  });
  const validatorsTriggered = [
    "constraint-compliance-checker",
    "solution-completeness-checker",
    "task-mode-fit-validator",
    "dialogical-balance-checker",
    "yes-man-detector",
    "contrarian-overreach-detector",
    "response-format-fit-validator",
    "first-answer-challenge",
  ];
  const taskClassFindings = [
    ...checkConstraintCompliance(state.structuredResponse, state.taskContract),
    ...checkSolutionCompleteness(state.structuredResponse, state.taskContract),
    ...validateTaskModeFit(state.structuredResponse, state.taskContract),
    ...checkDialogicalBalance(state.structuredResponse, state.taskContract),
    ...detectYesMan(state.structuredResponse, state.taskContract),
    ...detectContrarianOverreach(state.structuredResponse, state.taskContract),
    ...validateResponseFormatFit(state.structuredResponse, state.taskContract),
  ];
  const selfCritique = challengeFirstAnswer(state.structuredResponse, state.taskContract);
  const classValidationHasHardIssue =
    taskClassFindings.some((finding) => finding.severity === "error") ||
    selfCritique.shouldRevise;
  const selectedValidationTaskType = state.taskContract?.cognitiveTaskType || state.taskNatureState?.selectedTaskType;
  const taskClassValidationReport: TaskClassValidationReport = {
    selectedTaskType: isCognitiveTaskType(selectedValidationTaskType) ? selectedValidationTaskType : "conversational_light",
    validatorsTriggered,
    findings: taskClassFindings,
    verdict: classValidationHasHardIssue ? "retry" : "accept",
    score: Number(Math.max(0, 1 - (taskClassFindings.length * 0.12) - (selfCritique.shouldRevise ? 0.18 : 0)).toFixed(4)),
  };
  const deterministicClosedConstraintAccepted =
    taskClassValidationReport.selectedTaskType === "closed_constraint_deduction" &&
    state.executionArtifacts.inferential?.closedConstraintSolver?.recognized === true &&
    (state.executionArtifacts.generationRuntime?.used !== true ||
      state.trace.some((event) => event.action === "closed_constraint_solver_direct_generated"));

  const quality = decideAcceptOrRetry({
    coherence,
    density,
    epistemic,
    fluency,
    relevance: Number(clamp01(relevance - (memoryValidationRisk * 0.06)).toFixed(4)),
  });
  const confidenceAcceptable =
    quality.score >= confidencePolicy.minimumAcceptScore &&
    coherence >= confidencePolicy.minimumCoherence &&
    epistemic >= confidencePolicy.minimumEpistemic;
  const structureOk =
    (!structuralPolicy.enforceParagraphCohesion || brokenParagraphs.ok) &&
    emptySections.ok &&
    (!structuralPolicy.enforceCompletion || completion.ok) &&
    (!structuralPolicy.enforceSequence || sequence.ok) &&
    (!structuralPolicy.enforceTruncation || truncation.ok);
  const finalQualityDecision = deterministicClosedConstraintAccepted
    ? "accept"
    : quality.decision === "accept" &&
      confidenceAcceptable &&
      (!confidencePolicy.retryOnStructureFailure || structureOk) &&
      taskClassValidationReport.verdict === "accept"
      ? "accept"
      : "retry";
  const effectiveFactualOk = deterministicClosedConstraintAccepted ? true : factualOk;
  const effectiveStructureOk = deterministicClosedConstraintAccepted ? true : structureOk;
  const effectiveStructuralIssues = deterministicClosedConstraintAccepted
    ? taskClassFindings.map((finding) => `${finding.validatorId}:${finding.message}`)
    : [
        ...(structuralPolicy.enforceParagraphCohesion ? brokenParagraphs.issues : []),
        ...(structuralPolicy.enforceCompletion ? completion.issues : []),
        ...emptySections.issues,
        ...(structuralPolicy.enforceSequence ? sequence.issues : []),
        ...(structuralPolicy.enforceTruncation ? truncation.issues : []),
        ...structuralPolicy.rationale,
        ...taskClassFindings.map((finding) => `${finding.validatorId}:${finding.message}`),
        ...selfCritique.findings.map((finding) => `self_critique:${finding}`),
      ];

  state.validationReport = {
    factual: {
      ok: effectiveFactualOk,
      issues: factualIssues,
    },
    policy: {
      ok: privacy.ok && restricted.ok && safety.ok && sensitive.ok,
      issues: [...privacy.issues, ...restricted.issues, ...safety.issues, ...sensitive.issues],
    },
    structure: {
      ok: effectiveStructureOk,
      issues: effectiveStructuralIssues,
    },
    quality: {
      score: quality.score,
      decision: finalQualityDecision,
    },
  };

  state.confidenceScores.coherence = coherence;
  state.confidenceScores.final = quality.score;
  state.executionArtifacts = state.executionArtifacts || {
    knowledge: {
      cache: {},
      lastQuerySignature: "",
      lastUsedCache: false,
    },
  };
  state.executionArtifacts.validation = {
    activeValidationFamilies: [
      ...(runDeepEpistemicChecks ? ["validation_factual"] : []),
      "validation_policy",
      "validation_task_class",
      "validation_self_critique",
      `validation_mode_${validationMode}`,
      ...structuralPolicy.rationale.slice(0, 2),
      ...confidencePolicy.rationale.slice(0, 2),
    ],
    validationProfile: `${profile}:${structuralPolicy.structuralProfile}`,
    validationStage,
    validatorsTriggered,
    taskClassValidationIssues: taskClassFindings.map((finding) => `${finding.severity}:${finding.message}`),
    selfCritiqueFindings: selfCritique.findings,
    taskClassValidationReport,
    selfCritiqueReport: selfCritique,
  };

  // ai-system-anm: contrato semantico congelado apos validacao.
  state.validatedDraft = `${state.structuredResponse || state.draftResponse.text || ""}`.trim();
  if (!state.finalResponse) {
    state.finalResponse = state.validatedDraft;
  }

  state.trace.push(
    makeTraceEvent({
      layer: "validation",
      action: "multi_layer_validation_complete",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `stage=${validationStage}; profile=${profile}; mode=${validationMode}; factual=${state.validationReport.factual.ok}; policy=${state.validationReport.policy.ok}; ` +
        `structure=${state.validationReport.structure.ok}; decision=${state.validationReport.quality.decision}; ` +
        `taskClass=${taskClassValidationReport.selectedTaskType}; taskValidators=${validatorsTriggered.length}; selfCritique=${selfCritique.findings.length}; ` +
        `memoryRisk=${memoryValidationRisk.toFixed(2)}; stress=${regulatory.stressLoad.toFixed(2)}; runtimeOverclaim=${runtimeOverclaimSignal.toFixed(2)}; ` +
        `epistemicBridge=${epistemicValidation.verdict.score.toFixed(2)}; coverage=${epistemicValidation.coverage.coverage.toFixed(2)}`,
    }),
  );

  return handoffValidationToPresentation(state);
}
