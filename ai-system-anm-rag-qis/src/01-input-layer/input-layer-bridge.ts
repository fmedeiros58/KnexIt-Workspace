/**
 * Responsabilidade do arquivo:
 * - Normalizar e classificar entrada com sinais de seguranca e intencao.
 * - Atualizar snapshot textual compartilhado apos normalizacao.
 * - Encaminhar estado pronto para o language-layer.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { buildTextAnalysisSnapshot } from "../shared/text-processing/text-analysis-snapshot";
import { mergeConstraints, toConstraint } from "../shared/state/constraint-utils";
import { handoffInputToLanguage } from "./input-to-language-bridge";
import { inputNormalizer } from "./01-input-normalization-core/input-normalizer";
import { intentDetector } from "./04-input-classification-core/intent-detector";
import { domainDetector } from "./04-input-classification-core/domain-detector";
import { urgencyPriorityDetector } from "./04-input-classification-core/urgency-priority-detector";
import { promptInjectionDetector } from "./05-input-safety-core/prompt-injection-detector";
import { harmfulContentDetector } from "./05-input-safety-core/harmful-content-detector";
import { maliciousIntentDetector } from "./05-input-safety-core/malicious-intent-detector";
import { sensitiveDataDetector } from "./05-input-safety-core/sensitive-data-detector";
import { inputPolicyRouter } from "./05-input-safety-core/input-policy-router";
import { modalityDetector } from "./04-input-classification-core/modality-detector";
import { taskTypeDetector } from "./04-input-classification-core/task-type-detector";
import { affectiveSignalDetector } from "./04-input-classification-core/affective-signal-detector";
import { isConversationalPrompt } from "../shared/utils/conversation-signals";

function resolveInputIntent(
  normalizedMessage: string,
  detectedIntent: string,
  taskType: string,
) {
  if (isConversationalPrompt(normalizedMessage)) return "chat";
  if (detectedIntent === "chat") return taskType;
  return detectedIntent;
}

export async function runInputLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  const normalization = inputNormalizer({ rawText: state.rawMessage });
  const snapshot = buildTextAnalysisSnapshot(normalization.normalizedText);

  const intent = intentDetector({ text: normalization.normalizedText, language: normalization.languageHint });
  const domain = domainDetector({ text: normalization.normalizedText });
  const urgency = urgencyPriorityDetector({ text: normalization.normalizedText });
  const modality = modalityDetector({ text: normalization.normalizedText, channelHint: state.inputSignals.modality });
  const taskType = taskTypeDetector({ text: normalization.normalizedText });
  const affective = affectiveSignalDetector({ text: normalization.normalizedText });

  const injectionRisk = promptInjectionDetector({ text: normalization.normalizedText });
  const harmfulRisk = harmfulContentDetector({ text: normalization.normalizedText });
  const maliciousRisk = maliciousIntentDetector({ text: normalization.normalizedText });
  const sensitiveRisk = sensitiveDataDetector({ text: normalization.normalizedText });
  const policy = inputPolicyRouter({
    injectionFlagged: injectionRisk.flagged,
    maliciousFlagged: maliciousRisk.flagged,
    harmfulFlagged: harmfulRisk.flagged,
    sensitiveFlagged: sensitiveRisk.hasSensitiveData,
  });

  state.normalizedMessage = normalization.normalizedText;
  state.textAnalysisSnapshot = snapshot;
  state.language = normalization.languageHint;
  state.inputSignals.intent = resolveInputIntent(
    normalization.normalizedText,
    intent.intent,
    taskType.taskType,
  );
  state.inputSignals.domain = domain.domain;
  state.inputSignals.urgency = urgency.urgency;
  state.inputSignals.modality = modality.modality;
  state.inputSignals.safetyFlags = [
    ...new Set([
      ...normalization.issues,
      ...injectionRisk.flags,
      ...harmfulRisk.flags,
      ...maliciousRisk.flags,
      ...sensitiveRisk.flags,
      ...policy.policyFlags,
    ]),
  ];

  if (policy.action === "block") {
    state.activeConstraints = mergeConstraints(
      state.activeConstraints,
      [
        toConstraint("safety", "block_mode"),
        toConstraint("safety", "refuse_high_risk_request"),
      ],
      32,
    );
  } else if (policy.action === "caution") {
    state.activeConstraints = mergeConstraints(
      state.activeConstraints,
      [
        toConstraint("safety", "hardened_response_mode"),
        ...sensitiveRisk.redactionSuggestion.map((item) => toConstraint("sensitive_redaction", item)),
      ],
      32,
    );
  }

  state.userProfile = {
    ...state.userProfile,
    affectiveTone: affective.tone,
    affectiveIntensity: affective.intensity,
    detectedTaskType: taskType.taskType,
  };

  state.trace.push(
    makeTraceEvent({
      layer: "input",
      action: "normalized_and_classified",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `intent=${state.inputSignals.intent}; domain=${domain.domain}; urgency=${urgency.urgency}; ` +
        `policy=${policy.action}; safetyFlags=${state.inputSignals.safetyFlags.length}; tokens=${snapshot.tokenCount}; questions=${snapshot.questionCount}`,
    }),
  );

  return handoffInputToLanguage(state);
}
