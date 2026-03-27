/**
 * Responsabilidade do arquivo:
 * - Calibrar informalidade e leveza sem comprometer clareza/sobriedade.
 * - Aproximar estilo do usuario com limites contextuais.
 * - Conter casualidade em tarefas tecnicas e temas sensiveis.
 */
import type {
  BehaviorPersonalityInput,
  CasualnessLevel,
  PersonalityPolicyProfile,
} from "./behavior-and-personality-types";
import { applyPolicyCaps } from "./personality-policy";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function calibrateCasualness(
  input: BehaviorPersonalityInput,
  policy: PersonalityPolicyProfile,
): CasualnessLevel {
  if (!policy.allowCasualness) {
    return applyPolicyCaps(0.08, { min: 0.04, max: policy.maxCasualness });
  }

  const interactionBase =
    input.interactionType === "greeting" || input.interactionType === "social_smalltalk"
      ? 0.46
      : input.interactionType === "follow_up"
        ? 0.34
        : 0.22;
  const taskPenalty =
    input.taskType === "technical" || input.taskType === "factual"
      ? 0.24
      : input.taskType === "sensitive"
        ? 0.2
        : 0.06;
  const relationBoost =
    input.relationalDistance === "familiar"
      ? 0.1
      : input.relationalDistance === "professional"
        ? 0.04
        : -0.03;
  const formalityPenalty = clamp01(input.formalityNeed) * 0.36;
  const sensitivityPenalty =
    input.sensitivityLevel === "critical"
      ? 0.24
      : input.sensitivityLevel === "high"
        ? 0.16
        : input.sensitivityLevel === "medium"
          ? 0.08
          : 0;
  const explicitTargetRaw = input.userExplicitPreference?.preferredCasualness;
  const explicitTarget = Number.isFinite(explicitTargetRaw as number)
    ? clamp01(Number(explicitTargetRaw))
    : null;

  const withSignals =
    interactionBase +
    relationBoost -
    taskPenalty -
    formalityPenalty -
    sensitivityPenalty;
  const blended = explicitTarget !== null
    ? ((withSignals * 0.6) + (explicitTarget * 0.4))
    : withSignals;

  return applyPolicyCaps(blended, { min: 0.04, max: policy.maxCasualness });
}
