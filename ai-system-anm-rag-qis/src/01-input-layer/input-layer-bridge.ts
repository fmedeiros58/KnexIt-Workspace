import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { handoffInputToContext } from "./input-to-context-bridge";
import { inputNormalizer } from "./input-normalization-core/input-normalizer";
import { intentDetector } from "./input-classification-core/intent-detector";
import { domainDetector } from "./input-classification-core/domain-detector";
import { urgencyPriorityDetector } from "./input-classification-core/urgency-priority-detector";
import { promptInjectionDetector } from "./input-safety-core/prompt-injection-detector";
import { harmfulContentDetector } from "./input-safety-core/harmful-content-detector";
import { maliciousIntentDetector } from "./input-safety-core/malicious-intent-detector";
import { sensitiveDataDetector } from "./input-safety-core/sensitive-data-detector";
import { inputPolicyRouter } from "./input-safety-core/input-policy-router";
import { modalityDetector } from "./input-classification-core/modality-detector";
import { taskTypeDetector } from "./input-classification-core/task-type-detector";
import { affectiveSignalDetector } from "./input-classification-core/affective-signal-detector";

export async function runInputLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  const normalization = inputNormalizer({ rawText: state.rawMessage });
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
  state.language = normalization.languageHint;
  state.inputSignals.intent = intent.intent === "chat" ? taskType.taskType : intent.intent;
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
    state.activeConstraints = [...state.activeConstraints, "safety_block_mode", "refuse_high_risk_request"].slice(-16);
  } else if (policy.action === "caution") {
    state.activeConstraints = [...state.activeConstraints, "hardened_safety_response_mode", ...sensitiveRisk.redactionSuggestion].slice(-16);
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
      detail: `intent=${state.inputSignals.intent}; domain=${domain.domain}; urgency=${urgency.urgency}; policy=${policy.action}; safetyFlags=${state.inputSignals.safetyFlags.length}`,
    }),
  );

  return handoffInputToContext(state);
}
