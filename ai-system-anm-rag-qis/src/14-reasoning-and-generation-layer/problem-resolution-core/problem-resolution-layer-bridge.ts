/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: problem-resolution-layer-bridge
 * Responsibility: Attach reasoning completeness analysis to ProcessingState.
 */

import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { makeTraceEvent } from "../../shared/utils/trace-utils";
import { runProblemResolutionCoreOperator } from "./operators/problem-resolution-core-operator";

function firstNonEmpty(items: ReadonlyArray<string | null | undefined>): string {
  for (const item of items) {
    const normalized = String(item ?? "").trim();

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function updateDraftSurface(state: ProcessingState, text: string): void {
  const normalizedText = String(text ?? "").trim();

  if (!normalizedText) {
    return;
  }

  state.draftResponse = {
    ...(state.draftResponse ?? {}),
    text: normalizedText,
    sections: [{ title: "Resposta", content: normalizedText }],
  };
}

export function runProblemResolutionLayerBridge(
  state: ProcessingState,
): ProcessingState {
  const startedAt = Date.now();

  const draftAnswer = firstNonEmpty([
    state.draftResponse?.text,
    ...(state.draftResponse?.sections ?? []).map((section) => section.content),
    state.reasonedDraft,
    state.structuredResponse,
  ]);

  const operatorResult = runProblemResolutionCoreOperator({
    userInput: firstNonEmpty([
      state.normalizedMessage,
      state.rawMessage,
    ]),
    detectedIntent: state.inputSignals?.intent,
    taskContract: state.taskContract,
    sessionContext: state.activeContext,
    memoryContext: state.memorySnapshot?.selectedRecordIds ?? [],
    evidence: state.retrievedEvidence ?? [],
    responsePlan: state.responsePlanState?.structurePlan,
    reflectiveSignals: state.reflectiveNotes?.caveats ?? [],
    inferentialSignals: state.inferentialMap?.implications ?? [],
    metacognitiveSignals: state.metacognitiveState?.notes ?? [],
    epistemicSignals: state.epistemicIntegrationState?.conflicts ?? [],
    draftAnswer,
    languageHint: state.language,
    autoRepair: true,
  });

  const finalResolution = operatorResult.state;
  const finalDraft = firstNonEmpty([
    operatorResult.repairedDraft,
    draftAnswer,
  ]);

  if (operatorResult.repairApplied && finalDraft) {
    updateDraftSurface(state, finalDraft);
  }

  state.problemResolutionState = finalResolution;
  state.reasonedDraft = finalDraft;

  const closure = finalResolution.closure;
  const representation = readRecord(finalResolution, "representation");
  const repairMode = readString(operatorResult.repairPlan, "repairMode") || "none";

  const actionBudgetSignals = readActionBudgetSignals(representation);
  const observationLimitSignals = readObservationLimitSignals(representation);
  const domainMappingSignals = readDomainMappingSignals(representation);
  const scenarioBranchSignals = readScenarioBranchSignals(representation);
  const proofObligationSignals = readProofObligationSignals(representation);

  const artifact = {
    reasoningNeed: finalResolution.reasoningNeed,
    closurePassed: closure.passed,
    completionScore: closure.completionScore,

    logicalProblemKind: readString(representation, "logicalProblemKind"),
    taskType: readString(representation, "taskType"),
    language: readString(representation, "language"),

    riskTypes: dedupe(finalResolution.risks.map((risk) => risk.type)),
    riskCount: finalResolution.risks.length,

    repairApplied: operatorResult.repairApplied,
    repairMode,
    repairReasonCount: operatorResult.repairPlan.repairReasons.length,
    repairInstructionCount: operatorResult.repairPlan.repairInstructions.length,
    repairReasons: [...operatorResult.repairPlan.repairReasons],
    repairInstructions: [...operatorResult.repairPlan.repairInstructions],

    missingVariables: [...closure.missingVariables],
    unresolvedScenarios: [...closure.unresolvedScenarios],
    violatedConstraints: [...closure.violatedConstraints],
    unsupportedConclusions: [...closure.unsupportedConclusions],
    contradictions: [...closure.contradictions],
    missingProofObligations: [...(closure.missingProofObligations ?? [])],

    actionBudgetSignals,
    observationLimitSignals,
    domainMappingSignals,
    scenarioBranchSignals,
    proofObligationSignals,

    shouldEscalateToCriticalCouncil:
      !closure.passed ||
      closure.violatedConstraints.length > 0 ||
      closure.unresolvedScenarios.length > 0 ||
      closure.missingVariables.length > 0 ||
      closure.unsupportedConclusions.length > 0 ||
      closure.contradictions.length > 0 ||
      (closure.missingProofObligations ?? []).length > 0 ||
      repairMode === "substantial_revision" ||
      repairMode === "regenerate",

    evaluatedAt: new Date().toISOString(),
  };

  state.executionArtifacts.problemResolution =
    artifact as typeof state.executionArtifacts.problemResolution;

  state.trace.push(
    makeTraceEvent({
      layer: "generation",
      action: "problem_resolution_core_evaluated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `reasoningNeed=${finalResolution.reasoningNeed}; ` +
        `logicalKind=${artifact.logicalProblemKind || "unknown"}; ` +
        `closurePassed=${closure.passed}; ` +
        `completionScore=${closure.completionScore.toFixed(2)}; ` +
        `risks=${finalResolution.risks.length}; ` +
        `repairApplied=${operatorResult.repairApplied}; ` +
        `repairMode=${repairMode}; ` +
        `violatedConstraints=${closure.violatedConstraints.length}; ` +
        `unresolvedScenarios=${closure.unresolvedScenarios.length}; ` +
        `missingVariables=${closure.missingVariables.length}`,
    }),
  );

  return state;
}

function readRecord(source: unknown, key: string): Record<string, unknown> {
  if (!isRecord(source)) {
    return {};
  }

  const value = source[key];

  return isRecord(value) ? value : {};
}

function readString(source: unknown, key: string): string {
  if (!isRecord(source)) {
    return "";
  }

  const value = source[key];

  return typeof value === "string" ? value : "";
}

function readStringArray(source: unknown, key: string): string[] {
  if (!isRecord(source)) {
    return [];
  }

  const value = source[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(
    value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean),
  );
}

function readActionBudgetSignals(representation: Record<string, unknown>): string[] {
  const actionBudget = representation.actionBudget;

  if (!isRecord(actionBudget)) {
    return [];
  }

  return dedupe([
    numberSignal("maxActions", actionBudget.maxActions),
    numberSignal("targetLimit", actionBudget.targetLimit),
    booleanSignal("repeatAllowed", actionBudget.repeatAllowed),
    readString(actionBudget, "actionType"),
    ...readStringArray(actionBudget, "rawSignals"),
  ]);
}

function readObservationLimitSignals(
  representation: Record<string, unknown>,
): string[] {
  const observationLimits = representation.observationLimits;

  if (!Array.isArray(observationLimits)) {
    return [];
  }

  return dedupe(
    observationLimits.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [String(entry ?? "")];
      }

      return [
        readString(entry, "type"),
        readString(entry, "scope"),
        ...readStringArray(entry, "rawSignals"),
      ];
    }),
  );
}

function readDomainMappingSignals(
  representation: Record<string, unknown>,
): string[] {
  const domainMapping = representation.domainMapping;

  if (!isRecord(domainMapping)) {
    return [];
  }

  return dedupe([
    ...readStringArray(domainMapping, "variables").map(
      (entry) => `variable:${entry}`,
    ),
    ...readStringArray(domainMapping, "domains").map(
      (entry) => `domain:${entry}`,
    ),
    ...readStringArray(domainMapping, "assignmentRules").map(
      (entry) => `rule:${entry}`,
    ),
  ]);
}

function readScenarioBranchSignals(
  representation: Record<string, unknown>,
): string[] {
  const scenarioBranches = representation.scenarioBranches;

  if (!Array.isArray(scenarioBranches)) {
    return [];
  }

  return dedupe(
    scenarioBranches.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [String(entry ?? "")];
      }

      return [
        readString(entry, "id"),
        readString(entry, "condition"),
        ...readStringArray(entry, "expectedCoverageSignals"),
      ];
    }),
  );
}

function readProofObligationSignals(
  representation: Record<string, unknown>,
): string[] {
  const proofObligations = representation.proofObligations;

  if (!Array.isArray(proofObligations)) {
    return [];
  }

  return dedupe(
    proofObligations.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [String(entry ?? "")];
      }

      return [
        readString(entry, "id"),
        readString(entry, "description"),
        readString(entry, "category"),
      ];
    }),
  );
}

function numberSignal(label: string, value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${label}=${value}`
    : "";
}

function booleanSignal(label: string, value: unknown): string {
  return typeof value === "boolean" ? `${label}=${value}` : "";
}

function dedupe(values: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    const key = cleaned.toLowerCase();

    if (!cleaned || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}