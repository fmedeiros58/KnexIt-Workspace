/**
 * Responsabilidade do arquivo:
 * - Converter lacuna funcional em pergunta curta, natural e respeitosa.
 * - Evitar formulacao robotica, invasiva ou burocratica.
 * - Produzir pergunta de uma etapa, opcional e de baixo atrito.
 */
import type {
  BehaviorPersonalityInput,
  ProactiveQuestionPlan,
} from "./behavior-and-personality-types";
import type { ProactiveCuriosityDecision } from "./proactive-curiosity-regulator";

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chooseQuestion(
  opportunityType: ProactiveQuestionPlan["opportunityType"],
  input: BehaviorPersonalityInput,
): string {
  const formal = input.formalityNeed >= 0.7;
  const prefix = formal
    ? "Para eu ajustar melhor as proximas respostas, "
    : "Para eu ajustar melhor daqui pra frente, ";
  if (opportunityType === "style_preference") {
    return `${prefix}voce prefere um tom mais direto ou mais explicativo?`;
  }
  if (opportunityType === "detail_level") {
    return `${prefix}voce quer respostas mais curtas ou com mais detalhe?`;
  }
  if (opportunityType === "format_preference") {
    return `${prefix}voce prefere em topicos objetivos ou em paragrafo corrido?`;
  }
  if (opportunityType === "recurring_goal") {
    return `${prefix}esse contexto e mais para estudo, trabalho tecnico ou operacao?`;
  }
  if (opportunityType === "usage_context") {
    return `${prefix}esse uso e mais academico, tecnico ou operacional?`;
  }
  if (opportunityType === "constraint_preference") {
    return `${prefix}ha alguma restricao fixa de formato que devo respeitar sempre?`;
  }
  return "";
}

function sanitizeQuestion(text: string): string {
  const compact = `${text || ""}`.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const cleaned = compact
    .replace(/\b(posso perguntar\??\s*)/i, "")
    .replace(/\b(se quiser[, ]*)/i, "")
    .trim();
  if (!cleaned.endsWith("?")) return `${cleaned}?`;
  return cleaned;
}

function maybeAddOptionalLead(question: string, input: BehaviorPersonalityInput): string {
  const message = normalize(input.contextualSignals.normalizedMessage || "");
  const rush = /\b(rapido|agora|objetivo|direto)\b/.test(message);
  if (rush) return question;
  if (input.interactionType === "follow_up" || input.interactionType === "clarification") {
    return `Se voce quiser, ${question.charAt(0).toLowerCase()}${question.slice(1)}`;
  }
  return question;
}

export function shapeProactiveQuestion(
  input: BehaviorPersonalityInput,
  decision: ProactiveCuriosityDecision,
): ProactiveQuestionPlan {
  if (!decision.shouldAskProactiveQuestion) {
    return {
      shouldAsk: false,
      questionText: null,
      opportunityType: decision.opportunityType,
      rationale: decision.rationale,
    };
  }

  const raw = chooseQuestion(decision.opportunityType, input);
  const sanitized = sanitizeQuestion(raw);
  const optionalized = maybeAddOptionalLead(sanitized, input);

  return {
    shouldAsk: Boolean(optionalized),
    questionText: optionalized || null,
    opportunityType: decision.opportunityType,
    rationale: `question_shaped:${decision.opportunityType}`,
  };
}

