/**
 * Responsabilidade do arquivo:
 * - Compor sinais comportamentais finais do turno.
 * - Resolver conflitos entre calor, casualidade, empatia e contencao.
 * - Entregar perfil final consumivel pelas camadas seguintes.
 */
import type {
  BehaviorPersonalityOutput,
  BehavioralStyleNotes,
  PersonalityPolicyProfile,
  ProactiveQuestionPlan,
  AiIdentityProfile,
} from "./behavior-and-personality-types";
import { applyPolicyCaps } from "./personality-policy";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function mergeGuidance(parts: string[][]): string[] {
  return [...new Set(parts.flat().map((item) => `${item || ""}`.trim()).filter(Boolean))].slice(0, 12);
}

export function composeBehavioralStyle(input: {
  policy: PersonalityPolicyProfile;
  targetWarmth: number;
  targetCasualness: number;
  targetEmpathy: number;
  targetSocialPresence: number;
  targetRestraint: number;
  targetHumanizationLevel: number;
  targetFormalityAdjustment: number;
  styleTemplate: Omit<BehavioralStyleNotes, "microVariationCue">;
  socialPresenceNotes: string[];
  microVariationCue: string;
  microVariationNote: string;
  proactivityLevel: number;
  futureUtilityScore: number;
  memoryValueScore: number;
  socialIntrusivenessScore: number;
  questionTimingScore: number;
  questionFrequencyCap: number;
  proactiveQuestionPlan: ProactiveQuestionPlan;
  aiIdentity: AiIdentityProfile;
  additionalSafetyNotes?: string[];
}): BehaviorPersonalityOutput {
  const policy = input.policy;
  const restrainedCasualness = applyPolicyCaps(
    input.targetCasualness - (input.targetRestraint * 0.28) - (policy.sensitiveMode ? 0.08 : 0),
    { min: 0.04, max: policy.maxCasualness },
  );

  const restrainedWarmth = applyPolicyCaps(
    input.targetWarmth - (input.targetRestraint * 0.12),
    { min: 0.16, max: policy.maxWarmth },
  );

  const restrainedEmpathy = applyPolicyCaps(
    input.targetEmpathy - ((policy.technicalStrictMode ? 0.08 : 0) + (input.targetRestraint * 0.08)),
    { min: 0.08, max: policy.maxEmpathy },
  );

  const expressiveVariationRaw =
    0.22 +
    (restrainedCasualness * 0.26) +
    (input.targetSocialPresence * 0.18) +
    (input.targetHumanizationLevel * 0.12) -
    (input.targetRestraint * 0.24);
  const targetExpressiveVariation = applyPolicyCaps(expressiveVariationRaw, {
    min: 0.08,
    max: policy.maxExpressiveVariation,
  });

  const styleNotes: BehavioralStyleNotes = {
    openingStrategy: input.styleTemplate.openingStrategy,
    pacingStrategy: input.styleTemplate.pacingStrategy,
    transitionStyle: input.styleTemplate.transitionStyle,
    microVariationCue: input.microVariationCue,
    guidance: mergeGuidance([
      input.styleTemplate.guidance,
      input.socialPresenceNotes,
      [input.microVariationNote, "manter_consistencia_comportamental_entre_turnos"],
    ]),
  };

  const safetyNotes = [
    ...(input.additionalSafetyNotes || []),
    ...(policy.sensitiveMode ? ["evitar_intimidade_excessiva_em_tema_sensivel"] : []),
    ...(policy.technicalStrictMode ? ["nao_relaxar_sobriedade_em_tema_tecnico"] : []),
    ...policy.prohibitedPatterns.map((pattern) => `evitar:${pattern}`),
  ];

  return {
    targetWarmth: clamp01(restrainedWarmth),
    targetCasualness: clamp01(restrainedCasualness),
    targetEmpathy: clamp01(restrainedEmpathy),
    targetRestraint: clamp01(input.targetRestraint),
    targetSocialPresence: clamp01(input.targetSocialPresence),
    targetExpressiveVariation: clamp01(targetExpressiveVariation),
    targetHumanizationLevel: clamp01(input.targetHumanizationLevel),
    targetFormalityAdjustment: clamp01(input.targetFormalityAdjustment),
    proactivityLevel: clamp01(input.proactivityLevel),
    futureUtilityScore: clamp01(input.futureUtilityScore),
    memoryValueScore: clamp01(input.memoryValueScore),
    socialIntrusivenessScore: clamp01(input.socialIntrusivenessScore),
    questionTimingScore: clamp01(input.questionTimingScore),
    questionFrequencyCap: Math.max(0, Math.round(input.questionFrequencyCap)),
    proactiveQuestionPlan: input.proactiveQuestionPlan,
    aiIdentity: input.aiIdentity,
    styleNotes,
    safetyNotes: [...new Set(safetyNotes)].slice(0, 16),
    policyProfile: policy,
  };
}
