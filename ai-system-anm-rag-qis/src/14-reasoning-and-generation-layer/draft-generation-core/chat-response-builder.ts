/**
 * Responsabilidade do arquivo:
 * - Construir fallback conversacional curto e anti-eco para prompts de chat.
 * - Resolver foco de conversa e memoria de nome para respostas naturais.
 * - Bloquear fallback de chat em perguntas factuais/tecnicas verificaveis.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import {
  extractLatestUserUtterance,
  extractPreferredNameFromIdentityMemory,
  extractPreferredNameFromText,
  extractPreferredNameFromTurns,
  isConversationalPrompt,
  isGreetingMessage,
  isNameRecallPrompt,
  isNameSharePrompt,
  isReferentialFactualPrompt,
  isSmallTalkMessage,
  normalizeConversationText,
  toDisplayName,
} from "../../shared/utils/conversation-signals";

function normalize(value: string): string {
  return normalizeConversationText(value);
}

function isTechnicalRequest(text: string): boolean {
  return /\b(api|endpoint|typescript|javascript|python|sql|docker|stack trace|bug|debug|migrat|pipeline)\b/i.test(text);
}

function isVerifiableFactQuestion(text: string): boolean {
  const hasRoleCue = /\b(presidente|governador|prefeito|ceo|capital|cotacao|dolar|populacao|atual|latest|today|source|fonte)\b/i.test(text);
  const hasTimelineCue = /\b(quando|when|em que ano|que ano|ano|eleit[oa]|mandato|posse|reeleit[oa])\b/i.test(text);
  return hasRoleCue || hasTimelineCue || isReferentialFactualPrompt(text);
}

function hasRecentFactualAnchor(state: ProcessingState): boolean {
  const recent = state.recentTurns
    .slice(-6)
    .map((turn) => normalize(turn.content))
    .join(" ");
  if (!recent) return false;
  return /\b(presidente|governador|prefeito|ceo|capital|eleit[oa]|mandato|posse)\b/i.test(recent);
}

function isResearchRequest(text: string): boolean {
  return /\b(pesquise|pesquisa|buscar|busca|busque|procure|procurar|artigo|paper|estudo|literatura|referencia|referencias|scholar|scielo|pubmed|fonte|sources?|cite)\b/i.test(text);
}

function isRedoCommand(text: string): boolean {
  return /\b(entao|então)\s+(faca|faça|refaca|refaça)|\b(refaca|refaça)\b|\bfa(ca|ça)\s+de\s+novo\b/i.test(text);
}

function extractLatestUtterance(text: string): string {
  const focused = extractLatestUserUtterance(text);
  if (!focused) return text.trim();
  return focused;
}

export function resolveConversationFocus(text: string): string {
  return extractLatestUtterance(text || "");
}

function buildGreetingResponse(normalized: string): string | null {
  if (isGreetingMessage(normalized)) {
    return "Oi! Tudo bem? Como posso te ajudar agora?";
  }

  if (isSmallTalkMessage(normalized)) {
    return "Estou bem e pronto para ajudar. O que voce precisa agora?";
  }

  return null;
}

function buildNameIntentResponse(text: string): string | null {
  if (isNameSharePrompt(text)) {
    return "Claro, pode sim. Qual nome voce quer que eu use?";
  }

  return null;
}

function tokenOverlapRatio(a: string, b: string): number {
  const aTokens = new Set(normalize(a).split(" ").filter(Boolean));
  const bTokens = new Set(normalize(b).split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(aTokens.size, bTokens.size);
}

export function isEchoLike(candidate: string, reference: string): boolean {
  const candidateNormalized = normalize(candidate);
  const referenceNormalized = normalize(reference);
  if (!candidateNormalized || !referenceNormalized) return false;
  if (candidateNormalized === referenceNormalized) return true;

  if (
    candidateNormalized.startsWith(referenceNormalized) &&
    candidateNormalized.length <= Math.ceil(referenceNormalized.length * 1.35)
  ) {
    return true;
  }

  if (
    candidateNormalized.includes(referenceNormalized) &&
    candidateNormalized.length <= Math.ceil(referenceNormalized.length * 1.5)
  ) {
    return true;
  }

  return tokenOverlapRatio(candidateNormalized, referenceNormalized) >= 0.88;
}

function resolveKnownName(state: ProcessingState): string {
  const fromProfile = typeof state.userProfile.preferredName === "string"
    ? toDisplayName(state.userProfile.preferredName)
    : "";
  if (fromProfile) return fromProfile;
  const fromIdentity = extractPreferredNameFromIdentityMemory(state);
  if (fromIdentity) return fromIdentity;
  const fromTurns = extractPreferredNameFromTurns(state.recentTurns);
  return fromTurns || "";
}

export function buildNonEchoRecovery(state: ProcessingState): string {
  const focus = resolveConversationFocus(state.normalizedMessage);
  const knownName = resolveKnownName(state);
  const normalizedFocus = normalize(focus);

  if (isNameRecallPrompt(normalizedFocus)) {
    return knownName
      ? `Seu nome e ${knownName}.`
      : 'Ainda nao tenho seu nome salvo nesta conversa. Se quiser, me diga "me chame de ...".';
  }

  if (isNameSharePrompt(normalizedFocus)) {
    return "Claro, pode sim. Qual nome voce quer que eu use?";
  }

  if (isSmallTalkMessage(normalizedFocus)) {
    if (knownName) return `Tudo certo, ${knownName}. Como posso te ajudar agora?`;
    return "Tudo certo. Como posso te ajudar agora?";
  }

  return "Entendi. Me diga o objetivo em uma frase e eu respondo direto ao ponto.";
}

export function buildConversationalFallback(state: ProcessingState): string | null {
  if (state.executionPlan.selectedRoute !== "minimum") return null;

  const resolvedIntent =
    typeof state.userProfile.resolvedIntent === "string"
      ? state.userProfile.resolvedIntent
      : "chat";
  const isChatMode =
    state.selectedMode === "chat" ||
    resolvedIntent === "chat" ||
    isConversationalPrompt(state.normalizedMessage);
  if (!isChatMode) return null;

  const focus = extractLatestUtterance(state.normalizedMessage);
  if (!focus) return null;
  if (isTechnicalRequest(focus)) return null;
  if (isVerifiableFactQuestion(focus)) return null;
  if (isReferentialFactualPrompt(focus) && hasRecentFactualAnchor(state)) return null;
  if (isResearchRequest(focus)) return null;

  const nameIntent = buildNameIntentResponse(focus);
  if (nameIntent) return nameIntent;

  const preferredNameFromFocus = extractPreferredNameFromText(focus);
  if (preferredNameFromFocus) {
    state.userProfile = {
      ...state.userProfile,
      preferredName: preferredNameFromFocus,
    };
    return `Perfeito, ${preferredNameFromFocus}. Vou te chamar assim de agora em diante.`;
  }

  const knownName = resolveKnownName(state);
  if (knownName && isNameRecallPrompt(normalize(focus))) {
    state.userProfile = {
      ...state.userProfile,
      preferredName: knownName,
    };
    return `Seu nome e ${knownName}.`;
  }
  if (!knownName && isNameRecallPrompt(normalize(focus))) {
    return 'Ainda nao tenho seu nome salvo nesta conversa. Se quiser, me diga "me chame de ...".';
  }

  const greeting = buildGreetingResponse(normalize(focus));
  if (greeting) return greeting;

  if (isRedoCommand(focus)) {
    return "Posso refazer agora. Me diga exatamente o que devo buscar (ex.: 'nome do presidente do Brasil').";
  }

  if (focus.length <= 180 || isConversationalPrompt(focus)) {
    if (knownName) {
      return `${knownName}, me diga o objetivo em uma frase e eu respondo de forma objetiva.`;
    }
    return "Me diga o objetivo em uma frase e eu respondo de forma objetiva.";
  }

  return null;
}
