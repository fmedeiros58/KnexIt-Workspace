/**
 * Responsabilidade do arquivo:
 * - Executar analise reflexiva e atualizar estado apenas com sinal suficiente.
 * - Registrar metadados operacionais em executionArtifacts.reflective.
 * - Publicar constraints namespaced para auditabilidade dos sinais reflexivos.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { mergeConstraints, toConstraint } from "../shared/state/constraint-utils";
import { buildCriticalReflection } from "./reflective-core/critical-reflection-engine";
import { reflectiveHandoff } from "./reflective-output-core/reflective-handoff";
import { handoffReflectiveToInferential } from "./reflective-to-inferential-bridge";
import { runCommunicativeElaborationBridge } from "../bridges/communicative-elaboration.bridge";
import { runPhilosophicalSelfModelingBridgeAdapter } from "../bridges/philosophical-self-modeling.bridge";
import {
  evaluateObjectiveRationality,
  synthesizeObjectiveAnswer,
} from "./reflective-core/objective-rationality-core/objective-rationality-bridge";

function normalizeText(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeOption(value: string) {
  return `${value || ""}`
    .replace(/^[\s,;:.!?-]+/g, "")
    .replace(/[\s,;:.!?-]+$/g, "")
    .trim();
}

function toUniqueOptions(options: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const option of options) {
    const sanitized = sanitizeOption(option);
    if (!sanitized) continue;
    const normalized = normalizeText(sanitized);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(sanitized);
  }
  return output;
}

function extractOptionsFromQuery(query: string): string[] {
  const text = `${query || ""}`;
  if (!text.trim()) return [];

  const normalized = normalizeText(text);
  const betweenMatch = normalized.match(/\bentre\s+(.+?)\s+e\s+(.+?)(?:\?|$)/);
  if (betweenMatch?.[1] && betweenMatch?.[2]) {
    return toUniqueOptions([betweenMatch[1], betweenMatch[2]]);
  }

  const optionSplitRegex = /\s*(?:,?\s+ou\s+|\/|\s+\|\s+)\s*/i;
  const rawPieces = text.split(optionSplitRegex).map((part) => sanitizeOption(part));
  if (rawPieces.length >= 2) {
    return toUniqueOptions(rawPieces.slice(-2));
  }

  return [];
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export async function runReflectiveLayer(
  state: ProcessingState,
  input?: {
    query?: string;
    options?: string[];
    draftAnswer?: string;
  },
): Promise<ProcessingState> {
  const startedAt = Date.now();
  if (!state.communicativeElaborationState) {
    await runCommunicativeElaborationBridge(state);
  }
  if (!state.philosophicalSelfModelState) {
    await runPhilosophicalSelfModelingBridgeAdapter(state);
  }

  const reflection = buildCriticalReflection(state);
  const logicalFrame = state.logicalFrame;
  const communicativeTensions = state.communicativeElaborationState?.tensions || [];
  const communicativeRefinementPoints = state.communicativeElaborationState?.refinement.unresolvedPoints || [];
  const philosophicalQuestions = state.philosophicalSelfModelState?.philosophicalQuestions || [];
  const regulatory = state.memorySnapshot.regulatoryState;
  const runtimeTop = state.memorySnapshot.legacyRuntimeTopModules || [];
  const objectiveQuery = `${input?.query || state.normalizedMessage || state.rawMessage || ""}`.trim();
  const objectiveOptions = toUniqueOptions([
    ...(input?.options || []),
    ...extractOptionsFromQuery(objectiveQuery),
  ]);
  const objectiveDraftAnswer = `${input?.draftAnswer || state.draftResponse?.text || ""}`.trim();
  const objectiveRationalityResult = synthesizeObjectiveAnswer({
    query: objectiveQuery,
    options: objectiveOptions,
    draftAnswer: objectiveDraftAnswer || undefined,
  });

  const handoff = reflectiveHandoff({
    text: [
      ...reflection.assumptions,
      ...reflection.caveats,
      ...reflection.tensions,
      ...reflection.criticalCaveats,
      ...objectiveRationalityResult.evaluation.summary,
    ].join(" "),
    score: clamp01(
      (reflection.caveats.length * 0.12) +
      (reflection.assumptions.length * 0.08) +
      (objectiveRationalityResult.evaluation.shouldForceDirectAnswer ? 0.12 : 0),
    ),
  });

  const lowSignal = handoff.score < 0.36;

  if (!lowSignal) {
    state.reflectiveNotes.assumptions = reflection.assumptions;
    state.reflectiveNotes.caveats = reflection.caveats;
    state.reflectiveNotes.tensions = [
      ...reflection.tensions,
      ...communicativeTensions.map((row) => row.productiveQuestion),
      ...philosophicalQuestions.slice(0, 2),
    ].slice(0, 16);
    state.criticalCaveats = reflection.criticalCaveats;
    if (communicativeRefinementPoints.length > 0) {
      state.reflectiveNotes.assumptions = [
        ...state.reflectiveNotes.assumptions,
        ...communicativeRefinementPoints.map((row) => `refinement:${row}`),
      ].slice(0, 16);
    }
    if (logicalFrame) {
      state.reflectiveNotes.assumptions = [
        ...state.reflectiveNotes.assumptions,
        `logical_principle:${logicalFrame.dominantPrinciple}`,
        ...(logicalFrame.primaryGoal ? [`logical_primary_goal:${logicalFrame.primaryGoal}`] : []),
      ].slice(0, 16);
      if (logicalFrame.rejectedActions.length > 0) {
        state.reflectiveNotes.caveats = [
          ...state.reflectiveNotes.caveats,
          ...logicalFrame.rejectedActions.slice(0, 2).map((item) => `logical_rejected:${item.reason}`),
        ].slice(0, 16);
      }
    }

    state.confidenceScores.coherence = Number(
      clamp01((state.confidenceScores.coherence * 0.70) + (handoff.score * 0.30)).toFixed(4),
    );
  }

  state.executionArtifacts.reflective = {
    familyId: "critical_reflection",
    lowSignal,
    score: handoff.score,
    assumptionsCount: reflection.assumptions.length,
    caveatsCount: reflection.caveats.length,
    tensionsCount: reflection.tensions.length,
    communicativeTensionCount: communicativeTensions.length,
    philosophicalQuestionCount: philosophicalQuestions.length,
    objectiveRationality: objectiveRationalityResult.evaluation,
    objectiveFinalAnswer: objectiveRationalityResult.finalAnswer,
  };

  state.activeConstraints = mergeConstraints(
    state.activeConstraints,
    [
      ...(lowSignal ? [toConstraint("reflection", "low_signal")] : []),
      ...(reflection.criticalCaveats.length ? [toConstraint("reflection", "has_caveats")] : []),
      ...(regulatory.stressLoad >= 0.66 ? [toConstraint("reflection", "memory_regulatory_caution")] : []),
      ...(runtimeTop.length ? [toConstraint("reflection_runtime_top", runtimeTop.slice(0, 2).join(","))] : []),
      ...objectiveRationalityResult.evaluation.summary.map((item) => toConstraint("objective_rationality", item)),
      ...(objectiveRationalityResult.evaluation.shouldSuppressHedging
        ? [toConstraint("objective_rationality", "suppress_hedging")]
        : []),
      ...(objectiveRationalityResult.evaluation.shouldAnswerWithConclusionFirst
        ? [toConstraint("objective_rationality", "conclusion_first")]
        : []),
    ],
    32,
  );
  if (objectiveRationalityResult.finalAnswer) {
    state.activeContext = [
      ...state.activeContext,
      `objective_final_answer:${objectiveRationalityResult.finalAnswer}`,
    ].slice(-18);
  }

  state.trace.push(
    makeTraceEvent({
      layer: "reflective",
      action: lowSignal ? "critical_reflection_low_signal" : "critical_reflection_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `assumptions=${reflection.assumptions.length}; caveats=${reflection.caveats.length}; tensions=${reflection.tensions.length}; ` +
        `communicativeTensions=${communicativeTensions.length}; philosophicalQuestions=${philosophicalQuestions.length}; ` +
        `objectiveStyle=${objectiveRationalityResult.evaluation.recommendedAnswerStyle}; objectiveDominance=${objectiveRationalityResult.evaluation.dominance.kind}; ` +
        `handoff=${handoff.score.toFixed(2)}; stress=${regulatory.stressLoad.toFixed(2)}; runtimeTop=${runtimeTop.slice(0, 2).join(",")}`,
    }),
  );

  return handoffReflectiveToInferential(state);
}

export {
  evaluateObjectiveRationality,
  synthesizeObjectiveAnswer,
};
