/**
 * Responsabilidade do arquivo:
 * - Ajustar presenca social para respostas menos mecanicas e mais situadas.
 * - Equilibrar responsividade contextual com objetividade.
 * - Decidir quando abrir com toque social curto vs resposta direta.
 */
import type {
  BehaviorPersonalityInput,
  PersonalityPolicyProfile,
  SocialPresenceLevel,
} from "./behavior-and-personality-types";
import { applyPolicyCaps } from "./personality-policy";

export interface SocialPresenceRegulationResult {
  targetSocialPresence: SocialPresenceLevel;
  openingStrategy: "direct" | "anchored" | "light-touch";
  notes: string[];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function regulateSocialPresence(
  input: BehaviorPersonalityInput,
  policy: PersonalityPolicyProfile,
): SocialPresenceRegulationResult {
  const continuity = clamp01(input.contextualSignals.continuityScore ?? 0.45);
  const rapport = clamp01(input.contextualSignals.rapportScore ?? 0.5);
  const frustration = clamp01(input.frustrationSignal);
  const needsClarification = input.contextualSignals.needsClarification === true;

  const base =
    input.interactionType === "greeting" || input.interactionType === "social_smalltalk"
      ? 0.64
      : input.interactionType === "follow_up"
        ? 0.52
        : 0.44;
  const sensitivityPenalty = policy.sensitiveMode ? 0.1 : 0;
  const directPenalty = input.userExplicitPreference?.preferDirectStyle ? 0.08 : 0;
  const presenceRaw =
    base +
    (continuity * 0.18) +
    (rapport * 0.14) +
    (frustration * 0.08) +
    (needsClarification ? 0.06 : 0) -
    sensitivityPenalty -
    directPenalty;

  const targetSocialPresence = applyPolicyCaps(presenceRaw, { min: 0.2, max: 0.86 });
  const openingStrategy: SocialPresenceRegulationResult["openingStrategy"] =
    targetSocialPresence >= 0.62 && !policy.technicalStrictMode
      ? "light-touch"
      : targetSocialPresence >= 0.42
        ? "anchored"
        : "direct";

  const notes = [
    openingStrategy === "direct"
      ? "ir_direto_ao_ponto_sem_secura"
      : openingStrategy === "anchored"
        ? "ancorar_resposta_no_turno_atual"
        : "usar_abertura_curta_natural",
    needsClarification ? "manter_responsividade_para_ajuste_de_escopo" : "evitar_pre_ambulo_longo",
  ];

  return {
    targetSocialPresence,
    openingStrategy,
    notes,
  };
}

