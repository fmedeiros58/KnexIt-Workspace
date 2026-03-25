/**
 * Responsabilidade do arquivo:
 * - Orquestrar processamento linguistico e consolidacao do LanguageState.
 * - Atualizar snapshot textual compartilhado apos estabilizacao linguistica.
 * - Registrar trace/auditoria e encaminhar handoff podado ao conversation-layer.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { buildTextAnalysisSnapshot } from "../shared/text-processing/text-analysis-snapshot";
import { mergeConstraints, toConstraint } from "../shared/state/constraint-utils";
import { LANGUAGE_LAYER_STAGE_ORDER } from "./contracts/language-layer-contract";
import { discourseFormAggregation } from "./discourse-form-core/discourse-form-aggregation";
import { normalizationPriorityEngine } from "./linguistic-normalization-core/normalization-priority-engine";
import { languageResolutionEngine } from "./multilingual-language-core/language-resolution-engine";
import { pragmaticAggregationEngine } from "./pragmatic-language-core/pragmatic-aggregation-engine";
import { meaningResolver } from "./semantic-language-core/meaning-resolver";
import { affectiveAggregationEngine } from "./stylistic-language-core/affective-aggregation-engine";
import { handoffLanguageToConversation } from "./language-to-conversation-bridge";
import { languageStateBuilder } from "./language-state-builder";
import { languageStateNormalizer } from "./language-state-normalizer";
import { languageStateValidator } from "./language-state-validator";
import { languageTraceRecorder } from "./language-trace-recorder";

export async function runLanguageLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const sourceText = state.normalizedMessage || state.rawMessage;

  const language = languageResolutionEngine({
    text: sourceText,
    languageHint: state.language,
  });

  const normalization = normalizationPriorityEngine({ text: sourceText });
  const stabilizedText = normalization.stabilizedText;
  const stabilizedSnapshot = buildTextAnalysisSnapshot(stabilizedText);

  const pragmatic = pragmaticAggregationEngine({
    text: stabilizedText,
    snapshot: stabilizedSnapshot,
  });
  const semantic = meaningResolver({ text: stabilizedText });
  const discourse = discourseFormAggregation({ text: stabilizedText });
  const stylistic = affectiveAggregationEngine({ text: stabilizedText });

  const builtState = languageStateBuilder({
    sourceText,
    stabilizedText,
    canonicalText: normalization.canonicalText,
    normalizationSteps: normalization.steps,
    language,
    pragmatic,
    semantic,
    discourse,
    stylistic,
  });

  const normalizedState = languageStateNormalizer(builtState);
  const validation = languageStateValidator(normalizedState);

  state.normalizedMessage = normalizedState.stabilizedText;
  state.textAnalysisSnapshot = buildTextAnalysisSnapshot(normalizedState.stabilizedText);
  state.language = normalizedState.locale;
  state.inputSignals.urgency = normalizedState.urgency;
  state.languageState = normalizedState as ProcessingState["languageState"];

  state.activeConstraints = mergeConstraints(
    state.activeConstraints,
    [
      ...(normalizedState.mixedLanguage ? [toConstraint("language", "mixed_detected")] : []),
      ...(normalizedState.discourse.repetitionDetected ? [toConstraint("language", "repetition_detected")] : []),
      ...(validation.valid ? [] : validation.errors.map((issue) => toConstraint("language_state_warning", issue))),
    ],
    32,
  );

  state.executionArtifacts.languageLayer = {
    stageOrder: [...LANGUAGE_LAYER_STAGE_ORDER],
    languageEvidence: [...language.evidence],
    normalizationSteps: normalization.steps.map((step) => String(step)),
    validation,
  };

  state.userProfile = {
    ...state.userProfile,
    preferredLanguage: normalizedState.locale,
  };

  state.trace.push(
    languageTraceRecorder({
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      languageState: normalizedState,
    }),
  );

  return handoffLanguageToConversation(state);
}
