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
  return /\b(api|endpoint|typescript|javascript|python|sql|docker|stack trace|bug|debug|migrat|pipeline|normalizer|normalizers|normalize|regex|parser)\b/i.test(text);
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

function isPersonaIdentityPrompt(text: string): boolean {
  const normalized = normalize(text);
  return /\b(quem (?:e|eh) voce|quem e vc|qual (?:e|eh) seu nome|como voce se chama|voce e a leticia|voce eh a leticia|quem e a leticia|e o seu)\b/i.test(
    normalized,
  );
}

export function resolveConversationFocus(text: string): string {
  return extractLatestUtterance(text || "");
}

function buildGreetingResponse(normalized: string): string | null {
  if (isGreetingMessage(normalized)) {
    return "Oi! Eu sou a Leticia. Como posso te ajudar agora?";
  }

  if (isSmallTalkMessage(normalized)) {
    return "Estou bem e pronta para te ajudar. O que voce precisa agora?";
  }

  return null;
}

function buildNameIntentResponse(text: string): string | null {
  if (isNameSharePrompt(text)) {
    return "Claro. Qual nome voce quer que eu use para te chamar?";
  }

  return null;
}

function buildTechnicalClarificationResponse(text: string): string {
  const normalized = normalize(text);
  if (/\b(normalizer|normalizers|normalize)\b/i.test(normalized)) {
    return "Posso verificar os normalizers. Me envie o arquivo/trecho e o comportamento esperado vs atual.";
  }
  return "Posso ajudar no ajuste tecnico. Envie o trecho de codigo e o erro/comportamento atual.";
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

  if (isPersonaIdentityPrompt(normalizedFocus)) {
    return knownName
      ? `Eu sou a Leticia. E lembro de voce, ${knownName}.`
      : "Eu sou a Leticia. Estou aqui para te ajudar.";
  }

  if (isNameRecallPrompt(normalizedFocus)) {
    return knownName
      ? `Eu lembro sim. Seu nome e ${knownName}.`
      : 'Eu ainda nao tenho seu nome salvo nesta conversa. Se quiser, me diga "me chame de ...".';
  }

  if (isNameSharePrompt(normalizedFocus)) {
    return "Claro. Qual nome voce quer que eu use para te chamar?";
  }

  if (isSmallTalkMessage(normalizedFocus)) {
    if (knownName) return `Tudo certo por aqui, ${knownName}. Como posso te ajudar agora?`;
    return "Tudo certo por aqui. Como posso te ajudar agora?";
  }

  return "Entendi. Para eu te ajudar melhor, me diga o objetivo em uma frase e eu sigo com voce.";
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
  if (isTechnicalRequest(focus)) return buildTechnicalClarificationResponse(focus);
  if (isVerifiableFactQuestion(focus)) return null;
  if (isReferentialFactualPrompt(focus) && hasRecentFactualAnchor(state)) return null;
  if (isResearchRequest(focus)) return null;

  const normalizedFocus = normalize(focus);
  const knownName = resolveKnownName(state);
  const preferredNameFromMessage = extractPreferredNameFromText(state.normalizedMessage);
  const preferredNameFromFocus = extractPreferredNameFromText(focus);
  const declaredName = preferredNameFromMessage || preferredNameFromFocus || "";
  if (declaredName) {
    state.userProfile = {
      ...state.userProfile,
      preferredName: declaredName,
    };
  }

  const asksNameRecall = isNameRecallPrompt(normalizedFocus);
  const resolvedName = declaredName || knownName;
  if (asksNameRecall && resolvedName) {
    state.userProfile = {
      ...state.userProfile,
      preferredName: resolvedName,
    };
    return `Eu lembro sim. Seu nome e ${resolvedName}.`;
  }
  if (asksNameRecall) {
    return 'Eu ainda nao tenho seu nome salvo nesta conversa. Se quiser, me diga "me chame de ...".';
  }

  const nameIntent = buildNameIntentResponse(focus);
  if (nameIntent) return nameIntent;

  if (isPersonaIdentityPrompt(normalizedFocus)) {
    if (knownName) return `Eu sou a Leticia. E lembro de voce, ${knownName}.`;
    return "Eu sou a Leticia. Estou aqui para te ajudar.";
  }

  if (declaredName) {
    return `Perfeito, ${declaredName}. Eu vou te chamar assim daqui pra frente.`;
  }

  const greeting = buildGreetingResponse(normalizedFocus);
  if (greeting) return greeting;

  if (isRedoCommand(focus)) {
    return "Posso refazer agora. Me diga exatamente o que devo buscar (ex.: 'nome do presidente do Brasil').";
  }

  if (focus.length <= 180 || isConversationalPrompt(focus)) {
    if (knownName) {
      return `${knownName}, eu te ajudo melhor se voce me disser o objetivo em uma frase.`;
    }
    return "Eu te ajudo melhor se voce me disser o objetivo em uma frase.";
  }

  return null;
}
