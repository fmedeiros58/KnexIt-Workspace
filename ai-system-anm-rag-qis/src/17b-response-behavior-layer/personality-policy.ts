/**
 * Responsabilidade do arquivo:
 * - Definir regras normativas da personalidade funcional da camada 17b do ai-system-anm.
 * - Limitar humanizacao para evitar exageros, caricaturas e perda de sobriedade.
 * - Fornecer caps/minimos para composer comportamental.
 */
import type {
  BehaviorPersonalityInput,
  PersonalityPolicyProfile,
} from "./behavior-and-personality-types";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function sensitivityWeight(value: BehaviorPersonalityInput["sensitivityLevel"]): number {
  if (value === "critical") return 1;
  if (value === "high") return 0.8;
  if (value === "medium") return 0.45;
  return 0.15;
}

function isStrictTask(taskType: BehaviorPersonalityInput["taskType"]) {
  return taskType === "technical" || taskType === "factual" || taskType === "sensitive";
}

export function resolvePersonalityPolicy(input: BehaviorPersonalityInput): PersonalityPolicyProfile {
  const sensitivity = sensitivityWeight(input.sensitivityLevel);
  const strictTask = isStrictTask(input.taskType);
  const preferDirect = input.userExplicitPreference?.preferDirectStyle === true;
  const requestedFormality = clamp01(input.userExplicitPreference?.preferredFormality ?? input.formalityNeed);
  const strictnessSignal = clamp01((requestedFormality * 0.58) + (strictTask ? 0.25 : 0) + (sensitivity * 0.34));
  const sensitiveMode = input.sensitivityLevel === "high" || input.sensitivityLevel === "critical";
  const technicalStrictMode = strictTask || requestedFormality >= 0.68;

  const maxWarmth = clamp01(0.78 - (strictnessSignal * 0.22) + (input.frustrationSignal * 0.12));
  const maxCasualness = Math.max(0.06, clamp01(0.68 - (strictnessSignal * 0.58) - (sensitiveMode ? 0.16 : 0)));
  const maxEmpathy = clamp01(0.76 - (technicalStrictMode ? 0.18 : 0) + (input.frustrationSignal * 0.2));
  const minRestraint = clamp01(0.42 + (strictnessSignal * 0.42) + (sensitiveMode ? 0.14 : 0));
  const maxExpressiveVariation = clamp01(0.62 - (strictnessSignal * 0.36) - (sensitiveMode ? 0.08 : 0));

  return {
    allowCasualness: !preferDirect && maxCasualness >= 0.18,
    allowEmpathicShaping: maxEmpathy >= 0.24,
    allowSocialWarmthBoost: maxWarmth >= 0.32,
    maxWarmth,
    maxCasualness,
    maxEmpathy,
    minRestraint,
    maxExpressiveVariation,
    sensitiveMode,
    technicalStrictMode,
    prohibitedPatterns: [
      "empatia caricata",
      "entusiasmo artificial",
      "intimidade excessiva",
      "bordao repetitivo",
      "persona teatral",
      "humor automatico",
    ],
  };
}

export function applyPolicyCaps(
  value: number,
  bounds: { min?: number; max?: number },
): number {
  const bounded = clamp01(value);
  const min = clamp01(bounds.min ?? 0);
  const max = clamp01(bounds.max ?? 1);
  if (max < min) return min;
  return Math.max(min, Math.min(max, bounded));
}

export const PERSONALITY_POLICY_INVARIANTS = [
  "nao_inventar_fatos",
  "nao_alterar_factualidade",
  "nao_reduzir_precisao_tecnica",
  "nao_caricaturar_persona",
  "nao_explodir_informalidade_em_tema_sensivel",
  "nao_forcar_empatia_automatica",
] as const;
