/**
 * Responsabilidade do arquivo:
 * - Regular intensidade de empatia de modo sobrio e contextual.
 * - Aumentar tato quando houver frustracao/confusao/sensibilidade.
 * - Evitar dramatizacao ou empatia automatica indiscriminada.
 */
import type {
  BehaviorPersonalityInput,
  EmpathyLevel,
  PersonalityPolicyProfile,
} from "./behavior-and-personality-types";
import { applyPolicyCaps } from "./personality-policy";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function shapeEmpathicResponse(
  input: BehaviorPersonalityInput,
  policy: PersonalityPolicyProfile,
): EmpathyLevel {
  if (!policy.allowEmpathicShaping) {
    return applyPolicyCaps(0.1, { min: 0.06, max: policy.maxEmpathy });
  }

  const confusionSignal = clamp01(input.contextualSignals.detectedConfusion ?? 0);
  const frustrationSignal = clamp01(input.frustrationSignal);
  const baseByContext =
    input.sensitivityLevel === "critical"
      ? 0.48
      : input.sensitivityLevel === "high"
        ? 0.38
        : 0.24;
  const technicalPenalty =
    input.taskType === "technical" || input.taskType === "factual"
      ? 0.12
      : 0.02;
  const directPreferencePenalty = input.userExplicitPreference?.preferDirectStyle ? 0.1 : 0;
  const explicitTargetRaw = input.userExplicitPreference?.preferredEmpathy;
  const explicitTarget = Number.isFinite(explicitTargetRaw as number)
    ? clamp01(Number(explicitTargetRaw))
    : null;

  const withSignals =
    baseByContext +
    (frustrationSignal * 0.24) +
    (confusionSignal * 0.2) -
    technicalPenalty -
    directPreferencePenalty;
  const blended = explicitTarget !== null
    ? ((withSignals * 0.58) + (explicitTarget * 0.42))
    : withSignals;

  return applyPolicyCaps(blended, { min: 0.1, max: policy.maxEmpathy });
}
