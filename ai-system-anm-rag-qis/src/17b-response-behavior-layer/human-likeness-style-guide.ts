/**
 * Responsabilidade do arquivo:
 * - Definir heuristicas de "textura humana" sem teatralizar a persona.
 * - Modular cadencia e naturalidade mantendo inteligibilidade e sobriedade.
 * - Produzir notas de estilo seguras para camada de geracao/polimento.
 */
import type {
  BehaviorPersonalityInput,
  BehavioralStyleNotes,
  PersonalityPolicyProfile,
} from "./behavior-and-personality-types";
import { applyPolicyCaps } from "./personality-policy";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export interface HumanLikenessGuideResult {
  targetHumanizationLevel: number;
  targetRestraint: number;
  targetFormalityAdjustment: number;
  styleTemplate: Omit<BehavioralStyleNotes, "microVariationCue">;
  safetyNotes: string[];
}

export function buildHumanLikenessStyleGuide(
  input: BehaviorPersonalityInput,
  policy: PersonalityPolicyProfile,
  signals: {
    targetWarmth: number;
    targetCasualness: number;
    targetEmpathy: number;
    targetSocialPresence: number;
  },
): HumanLikenessGuideResult {
  const formalityNeed = clamp01(input.formalityNeed);
  const strictness = policy.technicalStrictMode ? 0.22 : 0;
  const restraintRaw =
    0.36 +
    (formalityNeed * 0.34) +
    (policy.sensitiveMode ? 0.22 : 0.04) +
    (strictness) -
    (signals.targetCasualness * 0.18);
  const targetRestraint = applyPolicyCaps(restraintRaw, { min: policy.minRestraint, max: 0.96 });

  const humanizationRaw =
    0.3 +
    (signals.targetWarmth * 0.24) +
    (signals.targetSocialPresence * 0.22) +
    (signals.targetEmpathy * 0.18) -
    (targetRestraint * 0.2) -
    (policy.sensitiveMode ? 0.06 : 0);
  const targetHumanizationLevel = applyPolicyCaps(humanizationRaw, { min: 0.14, max: 0.84 });

  const targetFormalityAdjustment = applyPolicyCaps(
    (formalityNeed * 0.72) + (policy.technicalStrictMode ? 0.18 : 0) + (policy.sensitiveMode ? 0.1 : 0),
    { min: 0.08, max: 0.96 },
  );

  const styleTemplate: HumanLikenessGuideResult["styleTemplate"] = {
    openingStrategy:
      targetRestraint >= 0.74
        ? "direct"
        : signals.targetSocialPresence >= 0.62
          ? "light-touch"
          : "anchored",
    pacingStrategy:
      input.taskType === "technical" || input.taskType === "factual"
        ? "concise"
        : input.contextualSignals.detectedConfusion && input.contextualSignals.detectedConfusion > 0.4
          ? "stepwise"
          : "balanced",
    transitionStyle:
      targetRestraint >= 0.7
        ? "clean"
        : signals.targetEmpathy >= 0.42
          ? "supportive"
          : "didactic",
    guidance: [
      "evitar_abertura_mecanica_repetitiva",
      "variar_cadencia_sem_perder_identidade",
      "manter_naturalidade_sem_quebrar_clareza",
      "nao_alterar_conteudo_factual_por_estilo",
    ],
  };

  const safetyNotes: string[] = [];
  if (policy.sensitiveMode) {
    safetyNotes.push("tema_sensivel: reduzir_descontracao_e_elevar_delicadeza");
  }
  if (policy.technicalStrictMode) {
    safetyNotes.push("tema_tecnico: preservar_sobriedade_e_precisao");
  }
  if (!policy.allowCasualness) {
    safetyNotes.push("casualidade_limitada_por_politica");
  }

  return {
    targetHumanizationLevel,
    targetRestraint,
    targetFormalityAdjustment,
    styleTemplate,
    safetyNotes,
  };
}

