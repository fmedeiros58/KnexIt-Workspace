/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 10-reflective-layer
 * Module: reflective-layer-bridge
 * Responsibility: Execute reflective analysis and apply local reflective operators before inferential handoff.
 * Primary Inputs: ProcessingState, reflective mode and reflective operators.
 * Primary Outputs: Updated reflective notes, reflective execution artifacts and inferential handoff.
 * Upstream Dependencies: preparatory/quantum outputs, communicative elaboration, local reflective operators
 * Downstream Dependencies: inferential layer
 * Invariants: Reflection stays local and does not replace inferential or validation logic.
 * Failure Modes: Sparse signals degrade to low-signal reflection with conservative caveats.
 * Audit Events: critical_reflection_built, critical_reflection_low_signal
 * Notes: Local critique/alternative operators help separate perspectives instead of blending them implicitly.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveLayerModeFromState } from "../05-complexity-and-orchestration-layer/activation-policy/layer-mode-resolver";
import { mergeConstraints, toConstraint } from "../shared/state/constraint-utils";
import { buildCriticalReflection } from "./reflective-core/critical-reflection-engine";
import { reflectiveHandoff } from "./reflective-output-core/reflective-handoff";
import { handoffReflectiveToInferential } from "./reflective-to-inferential-bridge";
import { runCommunicativeElaborationBridge } from "../bridges/communicative-elaboration.bridge";
import { runPhilosophicalSelfModelingBridgeAdapter } from "../bridges/philosophical-self-modeling.bridge";
import { reflectionDepthResolver } from "./operators/reflection-depth-resolver";
import { firstPassCritique } from "./operators/first-pass-critique";
import { alternativeInterpretationBuilder } from "./operators/alternative-interpretation-builder";
import {
  evaluateObjectiveRationality,
  synthesizeObjectiveAnswer,
} from "./reflective-core/objective-rationality-core/objective-rationality-bridge";

function repairCommonMojibake(value: string): string {
  return `${value || ""}`
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0081/g, "Á")
    .replace(/Ã\u0089/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã\u0093/g, "Ó")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã\u0087/g, "Ç")
    .replace(/intelig[\uFFFD]ncia/gi, "inteligencia")
    .replace(/informa[\uFFFD]{1,2}es/gi, "informacoes")
    .replace(/fa[\uFFFD]a/gi, "faca")
    .replace(/d[\uFFFD]vida/gi, "duvida")
    .replace(/o que [\uFFFD]/gi, "o que e")
    .replace(/let[\uFFFD]cia/gi, "Leticia")
    .replace(/usu[\uFFFD]rio/gi, "Usuario")
    .replace(/\uFFFD+/g, "");
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function sanitizeReflectiveText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function normalizeText(value: string) {
  return sanitizeReflectiveText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeOption(value: string) {
  return sanitizeReflectiveText(value)
    .replace(/^[\s,;:.!?-]+/g, "")
    .replace(/[\s,;:.!?-]+$/g, "")
    .trim();
}

function sanitizeStringArray(values: string[], limit: number): string[] {
  return (values || [])
    .map((item) => sanitizeReflectiveText(item))
    .filter(Boolean)
    .slice(0, limit);
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
  const reflectiveMode = resolveLayerModeFromState(state, "reflective");

  state.normalizedMessage = sanitizeReflectiveText(state.normalizedMessage || state.rawMessage);
  state.activeContext = sanitizeStringArray(state.activeContext, 20);
  state.activeConstraints = sanitizeStringArray(state.activeConstraints, 32);
  state.retrievedEvidence = sanitizeStringArray(state.retrievedEvidence, 24);

  if (!state.communicativeElaborationState) {
    await runCommunicativeElaborationBridge(state);
  }
  if (!state.philosophicalSelfModelState) {
    await runPhilosophicalSelfModelingBridgeAdapter(state);
  }

  const reflection = buildCriticalReflection(state);
  const reflectionDepth = reflectionDepthResolver(state, reflectiveMode);
  const critiqueNotes = sanitizeStringArray(firstPassCritique(state, reflectiveMode), 16);
  const alternativeInterpretations = sanitizeStringArray(
    alternativeInterpretationBuilder(state, reflectiveMode),
    16,
  );

  const logicalFrame = state.logicalFrame;
  const deliberative = state.deliberativeTaskState;
  const communicativeTensions =
    state.communicativeElaborationState?.tensions || [];
  const communicativeRefinementPoints =
    state.communicativeElaborationState?.refinement.unresolvedPoints || [];
  const philosophicalQuestions =
    state.philosophicalSelfModelState?.philosophicalQuestions || [];
  const regulatory = state.memorySnapshot.regulatoryState;
  const runtimeTop = state.memorySnapshot.legacyRuntimeTopModules || [];

  const objectiveQuery = sanitizeReflectiveText(
    `${input?.query || state.normalizedMessage || state.rawMessage || ""}`.trim(),
  );

  const objectiveOptions = toUniqueOptions([
    ...(input?.options || []),
    ...extractOptionsFromQuery(objectiveQuery),
  ]);

  const objectiveDraftAnswer = sanitizeReflectiveText(
    `${input?.draftAnswer || state.draftResponse?.text || ""}`.trim(),
  );

  const objectiveRationalityResult = synthesizeObjectiveAnswer({
    query: objectiveQuery,
    options: objectiveOptions,
    draftAnswer: objectiveDraftAnswer || undefined,
  });

  const safeAssumptions = sanitizeStringArray(reflection.assumptions, 16);
  const safeCaveats = sanitizeStringArray(reflection.caveats, 16);
  const safeTensions = sanitizeStringArray(reflection.tensions, 16);
  const safeCriticalCaveats = sanitizeStringArray(reflection.criticalCaveats, 16);
  const safeCommunicativeQuestions = sanitizeStringArray(
    communicativeTensions.map((row) => row.productiveQuestion),
    8,
  );
  const safeRefinementPoints = sanitizeStringArray(
    communicativeRefinementPoints.map((row) => `refinement:${row}`),
    8,
  );
  const safePhilosophicalQuestions = sanitizeStringArray(philosophicalQuestions, 4);
  const safeObjectiveSummary = sanitizeStringArray(
    objectiveRationalityResult.evaluation.summary,
    8,
  );

  const handoff = reflectiveHandoff({
    text: [
      ...safeAssumptions,
      ...safeCaveats,
      ...safeTensions,
      ...safeCriticalCaveats,
      ...critiqueNotes,
      ...alternativeInterpretations.map((item) => `alternative:${item}`),
      ...safeObjectiveSummary,
    ].join(" "),
    score: clamp01(
      (safeCaveats.length * 0.12) +
        (safeAssumptions.length * 0.08) +
        (critiqueNotes.length * 0.04) +
        (alternativeInterpretations.length * 0.03) +
        (reflectionDepth === "heavy" ? 0.08 : reflectionDepth === "medium" ? 0.04 : 0) +
        (objectiveRationalityResult.evaluation.shouldForceDirectAnswer ? 0.12 : 0),
    ),
  });

  const lowSignal = handoff.score < 0.36;

  if (!lowSignal) {
    state.reflectiveNotes.assumptions = safeAssumptions;
    state.reflectiveNotes.caveats = [...safeCaveats, ...critiqueNotes].slice(0, 16);
    state.reflectiveNotes.tensions = [
      ...safeTensions,
      ...alternativeInterpretations.map((item) => `interpretacao_alternativa:${item}`),
      ...safeCommunicativeQuestions,
      ...safePhilosophicalQuestions.slice(0, 2),
    ].slice(0, 16);

    state.criticalCaveats = safeCriticalCaveats;

    if (safeRefinementPoints.length > 0) {
      state.reflectiveNotes.assumptions = [
        ...state.reflectiveNotes.assumptions,
        ...safeRefinementPoints,
      ].slice(0, 16);
    }

    if (logicalFrame) {
      state.reflectiveNotes.assumptions = [
        ...state.reflectiveNotes.assumptions,
        `logical_principle:${sanitizeReflectiveText(logicalFrame.dominantPrinciple)}`,
        ...(logicalFrame.primaryGoal
          ? [`logical_primary_goal:${sanitizeReflectiveText(logicalFrame.primaryGoal)}`]
          : []),
      ].slice(0, 16);

      if (logicalFrame.rejectedActions.length > 0) {
        state.reflectiveNotes.caveats = [
          ...state.reflectiveNotes.caveats,
          ...logicalFrame.rejectedActions
            .slice(0, 2)
            .map((item) => `logical_rejected:${sanitizeReflectiveText(item.reason)}`),
        ].slice(0, 16);
      }
    }

    if (deliberative?.isActive) {
      const distinctionLabels = deliberative.obligationGraph
        .filter((item) => item.type === "distinction")
        .map((item) => `distincao_obrigatoria:${sanitizeReflectiveText(item.label)}`);

      const objectionRequired = deliberative.obligationGraph.some((item) => item.type === "objection");
      const assumptionAuditRequired = deliberative.obligationGraph.some((item) => item.type === "assumption_audit");

      state.reflectiveNotes.assumptions = [
        ...state.reflectiveNotes.assumptions,
        ...deliberative.assumptionLedger
          .slice(0, 3)
          .map((item) => `deliberative_assumption:${sanitizeReflectiveText(item.statement)}`),
      ].slice(0, 16);

      state.reflectiveNotes.tensions = [
        ...state.reflectiveNotes.tensions,
        ...distinctionLabels.slice(0, 3),
        ...(objectionRequired ? ["deliberative_steelman_objection_required"] : []),
        ...(assumptionAuditRequired ? ["deliberative_assumption_audit_required"] : []),
      ].slice(0, 16);

      if (deliberative.strongestSelfObjection) {
        state.reflectiveNotes.caveats = [
          ...state.reflectiveNotes.caveats,
          `deliberative_objection:${sanitizeReflectiveText(deliberative.strongestSelfObjection)}`,
        ].slice(0, 16);
      }
    }

    state.confidenceScores.coherence = Number(
      clamp01((state.confidenceScores.coherence * 0.7) + (handoff.score * 0.3)).toFixed(4),
    );
  }

  state.executionArtifacts.reflective = {
    familyId: "critical_reflection",
    lowSignal,
    score: handoff.score,
    mode: reflectiveMode,
    depth: reflectionDepth,
    assumptionsCount: safeAssumptions.length,
    caveatsCount: safeCaveats.length,
    tensionsCount: safeTensions.length,
    critiqueCount: critiqueNotes.length,
    alternativeCount: alternativeInterpretations.length,
    communicativeTensionCount: communicativeTensions.length,
    philosophicalQuestionCount: philosophicalQuestions.length,
    objectiveRationality: objectiveRationalityResult.evaluation,
    objectiveFinalAnswer: sanitizeReflectiveText(objectiveRationalityResult.finalAnswer || ""),
  };

  state.activeConstraints = mergeConstraints(
    state.activeConstraints,
    [
      ...(lowSignal ? [toConstraint("reflection", "low_signal")] : []),
      ...(safeCriticalCaveats.length ? [toConstraint("reflection", "has_caveats")] : []),
      ...(critiqueNotes.length ? [toConstraint("reflection", "operator_critique_active")] : []),
      ...(alternativeInterpretations.length ? [toConstraint("reflection", "alternative_interpretations_active")] : []),
      ...(regulatory.stressLoad >= 0.66 ? [toConstraint("reflection", "memory_regulatory_caution")] : []),
      ...(runtimeTop.length ? [toConstraint("reflection_runtime_top", runtimeTop.slice(0, 2).join(","))] : []),
      ...safeObjectiveSummary.map((item) => toConstraint("objective_rationality", item)),
      ...(objectiveRationalityResult.evaluation.shouldSuppressHedging
        ? [toConstraint("objective_rationality", "suppress_hedging")]
        : []),
      ...(objectiveRationalityResult.evaluation.shouldAnswerWithConclusionFirst
        ? [toConstraint("objective_rationality", "conclusion_first")]
        : []),
    ],
    32,
  );

  const sanitizedObjectiveFinalAnswer = sanitizeReflectiveText(
    objectiveRationalityResult.finalAnswer || "",
  );
  if (sanitizedObjectiveFinalAnswer) {
    state.activeContext = [
      ...state.activeContext,
      `objective_final_answer:${sanitizedObjectiveFinalAnswer}`,
    ].slice(-18);
  }

  state.trace.push(
    makeTraceEvent({
      layer: "reflective",
      action: lowSignal ? "critical_reflection_low_signal" : "critical_reflection_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `mode=${reflectiveMode}; depth=${reflectionDepth}; assumptions=${safeAssumptions.length}; caveats=${safeCaveats.length}; tensions=${safeTensions.length}; ` +
        `critique=${critiqueNotes.length}; alternatives=${alternativeInterpretations.length}; ` +
        `communicativeTensions=${communicativeTensions.length}; philosophicalQuestions=${philosophicalQuestions.length}; ` +
        `objectiveStyle=${sanitizeReflectiveText(objectiveRationalityResult.evaluation.recommendedAnswerStyle)}; ` +
        `objectiveDominance=${sanitizeReflectiveText(objectiveRationalityResult.evaluation.dominance.kind)}; ` +
        `handoff=${handoff.score.toFixed(2)}; stress=${regulatory.stressLoad.toFixed(2)}; runtimeTop=${runtimeTop.slice(0, 2).join(",")}`,
    }),
  );

  return handoffReflectiveToInferential(state);
}

export {
  evaluateObjectiveRationality,
  synthesizeObjectiveAnswer,
};