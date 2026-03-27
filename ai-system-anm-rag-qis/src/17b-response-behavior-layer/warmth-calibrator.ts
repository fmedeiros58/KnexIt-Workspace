/**
 * Responsabilidade do arquivo:
 * - Calibrar calor humano textual sem afetar factualidade.
 * - Ajustar cordialidade por contexto (frustracao, sensibilidade, formalidade).
 * - Evitar excesso afetivo em temas tecnicos/sensiveis.
 */
import type {
  BehaviorPersonalityInput,
  PersonalityPolicyProfile,
  WarmthLevel,
} from "./behavior-and-personality-types";
import { applyPolicyCaps } from "./personality-policy";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function calibrateWarmth(
  input: BehaviorPersonalityInput,
  policy: PersonalityPolicyProfile,
): WarmthLevel {
  const baseByTask =
    input.taskType === "technical" || input.taskType === "factual"
      ? 0.36
      : input.taskType === "sensitive"
        ? 0.46
        : 0.42;
  const toneBoost =
    /\b(friendly|warm|positive|acolhedor|cordial)\b/i.test(input.userTone)
      ? 0.08
      : /\b(cold|frio|hostil|dry|seco)\b/i.test(input.userTone)
        ? -0.06
        : 0;
  const frustrationBoost = clamp01(input.frustrationSignal) * 0.22;
  const enthusiasmBoost = clamp01(input.enthusiasmSignal) * 0.08;
  const sensitivityBoost =
    input.sensitivityLevel === "critical"
      ? 0.12
      : input.sensitivityLevel === "high"
        ? 0.08
        : input.sensitivityLevel === "medium"
          ? 0.04
          : 0;
  const formalityPenalty = clamp01(input.formalityNeed) * 0.1;
  const explicitTargetRaw = input.userExplicitPreference?.preferredWarmth;
  const explicitTarget = Number.isFinite(explicitTargetRaw as number)
    ? clamp01(Number(explicitTargetRaw))
    : null;

  const withSignals =
    baseByTask +
    toneBoost +
    frustrationBoost +
    enthusiasmBoost +
    sensitivityBoost -
    formalityPenalty;

  const blended = explicitTarget !== null
    ? ((withSignals * 0.55) + (explicitTarget * 0.45))
    : withSignals;

  return applyPolicyCaps(blended, { min: 0.18, max: policy.maxWarmth });
}
