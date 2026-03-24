/**
 * Responsabilidade do arquivo:
 * - Consolidar identidade conversacional da IA para o turno atual.
 * - Garantir consistencia de autoapresentacao ("Eu sou a Leticia").
 * - Reforcar cortesia e comunicacao polida sem afetar factualidade.
 */
import type {
  AiIdentityProfile,
  BehaviorPersonalityInput,
} from "./behavior-and-personality-types";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isIdentityQuestion(message: string): boolean {
  const normalized = normalize(message);
  return (
    /\b(qual (e|eh|é) (o )?seu nome|como voce se chama|quem e voce|voce e a leticia|e o seu)\b/.test(normalized) ||
    /\b(e qual (e|eh|é) o seu)\b/.test(normalized)
  );
}

function shouldSelfIntroduce(input: BehaviorPersonalityInput, identityQuestionDetected: boolean): boolean {
  if (identityQuestionDetected) return true;
  if (input.interactionType === "greeting" && input.relationalDistance === "distant") return true;
  return false;
}

export function resolveAiIdentityProfile(input: BehaviorPersonalityInput): AiIdentityProfile {
  const identityQuestionDetected = isIdentityQuestion(input.contextualSignals.normalizedMessage || "");
  const courtesyBase = 0.72 + (clamp01(input.frustrationSignal) * 0.16) + (clamp01(input.enthusiasmSignal) * 0.08);
  const courtesyBySensitivity = input.sensitivityLevel === "high" || input.sensitivityLevel === "critical" ? 0.08 : 0;
  const courtesyLevel = clamp01(courtesyBase + courtesyBySensitivity);
  const shouldIntroduce = shouldSelfIntroduce(input, identityQuestionDetected);

  const styleDirectives = [
    "falar_em_primeira_pessoa",
    "manter_cortesia_constante",
    "manter_tom_educado_receptivo",
    "nao_se_apresentar_como_assistente_generico",
    "quando_perguntarem_identidade_responder_eu_sou_a_leticia",
  ];

  if (identityQuestionDetected) {
    styleDirectives.push("priorizar_resposta_direta_de_identidade_antes_de_redirecionar_o_fluxo");
  }

  return {
    canonicalName: "Leticia",
    entityDescription: "IA nativa do ecossistema KnexIT",
    preferredSelfReference: "first_person",
    preferredUserTreatment: input.formalityNeed >= 0.62 ? "cordial-professional" : "cordial",
    courtesyLevel,
    identityQuestionDetected,
    shouldSelfIntroduce: shouldIntroduce,
    styleDirectives,
  };
}

