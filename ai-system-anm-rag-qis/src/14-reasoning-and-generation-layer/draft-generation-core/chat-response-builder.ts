/**
 * Responsabilidade do arquivo:
 * - Construir fallback conversacional curto e anti-eco para prompts de chat.
 * - Resolver foco de conversa e memoria de nome para respostas naturais.
 * - Bloquear fallback de chat em perguntas factuais/tecnicas verificaveis.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import {
  classifyGreetingFamily,
  isAssistantCreatorPrompt,
  isAssistantIdentityPrompt,
  isAssistantNameOriginPrompt,
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
import { resolveIdentityRuntimeFallback } from "../../17b-response-behavior-layer/identity-runtime-bridge";

function normalize(value: string): string {
  return normalizeConversationText(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidTimeZone(value: string): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function resolveUserTimeZone(state: ProcessingState): string {
  const profile = state.userProfile || {};
  const profileRecord = profile as Record<string, unknown>;
  const candidates = [
    readString(profileRecord.timeZone),
    readString(profileRecord.timezone),
    readString(profileRecord.userTimeZone),
    readString(profileRecord.userTimezone),
    readString(profileRecord.tz),
    readString(profileRecord.tzName),
  ];
  const selected = candidates.find((candidate) => isValidTimeZone(candidate));
  return selected || "America/Sao_Paulo";
}

type DayGreetingPhase = "morning" | "afternoon" | "night";

function resolveDayGreetingPhase(timeZone: string): DayGreetingPhase {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
  }).formatToParts(new Date());
  const hourText = parts.find((part) => part.type === "hour")?.value || "12";
  const hour = Number.parseInt(hourText, 10);
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 17) return "afternoon";
  return "night";
}

function resolveDayGreetingLabel(phase: DayGreetingPhase): string {
  if (phase === "morning") return "Bom dia";
  if (phase === "afternoon") return "Boa tarde";
  return "Boa noite";
}

function canonicalSurface(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .replace(/[!?.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickVariant(state: ProcessingState, variants: string[], seed = 0): string {
  if (variants.length === 0) return "";
  if (variants.length === 1) return variants[0];

  const recentAssistant = state.recentTurns
    .filter((turn) => turn.role === "assistant")
    .slice(-6)
    .map((turn) => canonicalSurface(turn.content));
  const recentSet = new Set(recentAssistant);

  const turnCount = Number.isFinite(state.conversationState.turnCount) ? state.conversationState.turnCount : 0;
  const base = Math.max(0, turnCount + state.recentTurns.length + seed);
  const start = base % variants.length;

  for (let offset = 0; offset < variants.length; offset += 1) {
    const candidate = variants[(start + offset) % variants.length];
    if (!recentSet.has(canonicalSurface(candidate))) return candidate;
  }

  return variants[start];
}

function isCheckinPrompt(normalized: string): boolean {
  return /\b(tudo bem|tudo certo|tudo tranquilo|como vai|como esta|como voce esta|como vc ta|como c ta|que tal|blz|beleza|de boa|suave|tranquilo)\b/i.test(
    normalized,
  );
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
  return /\bentao\s+(faca|refaca)\b|\brefaca\b|\bfaca\s+de\s+novo\b/i.test(text);
}

function extractLatestUtterance(text: string): string {
  const focused = extractLatestUserUtterance(text);
  if (!focused) return text.trim();
  return focused;
}

function isPersonaIdentityPrompt(text: string): boolean {
  return isAssistantIdentityPrompt(text);
}

function isPersonaNameOriginPrompt(text: string): boolean {
  return isAssistantNameOriginPrompt(text);
}

function isPersonaCreatorPrompt(text: string): boolean {
  return isAssistantCreatorPrompt(text);
}

function isCreatorExpansionPrompt(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  return /\b(mais informacoes|mais detalhes|fale mais|me diga mais|me conte mais|quero saber mais|sobre ele|desse mesmo|mais dele|falar mais dele|pode me falar mais dele|vc tem certeza|voce tem certeza|tem certeza|isso esta correto|isso esta certo|confirma isso|confirmar isso)\b/i.test(
    normalized,
  );
}

function hasRecentCreatorContext(state: ProcessingState): boolean {
  const recent = state.recentTurns
    .slice(-8)
    .map((turn) => normalize(turn.content || ""))
    .join(" ");
  if (!recent) return false;
  return /\bmedeiros\b/.test(recent) && /\b(leticia|idealizador do projeto)\b/.test(recent);
}

function buildPersonaIdentityScopedResponse(message: string): string | null {
  const resolved = resolveIdentityRuntimeFallback(message);
  if (!resolved) return null;
  return resolved;
}

function ensureFirstPersonIdentityLead(text: string): string {
  const trimmed = `${text || ""}`.trim();
  if (!trimmed) return "Eu sou a Letícia.";

  const normalized = normalize(trimmed);
  if (/^eu sou a leticia\b/.test(normalized)) return trimmed;
  if (/^(sou a leticia|eu me chamo leticia|meu nome e leticia|pode me chamar de leticia)\b/.test(normalized)) {
    return `Eu sou a Letícia. ${trimmed}`;
  }
  if (/\bleticia\b/.test(normalized)) {
    return `Eu sou a Letícia. ${trimmed}`;
  }
  return `Eu sou a Letícia. ${trimmed}`;
}

function ensureNameOriginGrounding(text: string): string {
  let output = `${text || ""}`.trim();
  if (!output) return output;

  if (!/language-engineered technology for intelligent cognition, interaction and assistance/i.test(output)) {
    output = `${output} Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance.`;
  }

  const normalized = normalize(output);
  if (!/\bhomenagem\b.*\bfilha\b.*\bleticia\b/.test(normalized)) {
    output = `${output} Ele também é uma homenagem de Medeiros à sua filha Letícia.`;
  }

  return output.trim();
}

function ensureCreatorContextGrounding(text: string): string {
  let output = `${text || ""}`.trim();
  if (!output) {
    return "No contexto desta IA, Medeiros é o idealizador do projeto Letícia.";
  }

  const normalized = normalize(output);
  if (!/\bmedeiros\b/.test(normalized) || !/\bidealizador\b.*\bprojeto\b.*\bleticia\b/.test(normalized)) {
    output = `${output} No contexto desta IA, Medeiros é o idealizador do projeto Letícia.`;
  }

  return output.trim();
}

function ensureCreatorBiographyGuard(text: string): string {
  const output = `${text || ""}`.trim();
  if (!output) {
    return "Não tenho dados biográficos verificados além de que, no contexto desta IA, Medeiros é o idealizador do projeto Letícia.";
  }

  const normalized = normalize(output);
  if (/\bnao tenho dados biograficos verificados\b/.test(normalized)) {
    return output;
  }

  return `${output} Não tenho dados biográficos verificados além desse contexto do projeto.`;
}

export function resolveConversationFocus(text: string): string {
  return extractLatestUtterance(text || "");
}

function buildGreetingResponse(state: ProcessingState, normalized: string): string | null {
  const familyFromState = `${state.preRouteSignals?.greetingFamily || ""}`.trim().toLowerCase();
  const family = familyFromState && familyFromState !== "none"
    ? familyFromState
    : classifyGreetingFamily(normalized);
  const greetingDetected = Boolean(family) || isGreetingMessage(normalized);
  const checkinDetected = family === "greeting_checkin" || isCheckinPrompt(normalized);

  if (!greetingDetected && !checkinDetected) return null;

  const timeZone = resolveUserTimeZone(state);
  const phase = resolveDayGreetingPhase(timeZone);
  const dayGreeting = resolveDayGreetingLabel(phase);

  if (family === "greeting_courtesy_ping") {
    return pickVariant(state, [
      `Estou por aqui, sim. ${dayGreeting}! Como posso te ajudar agora?`,
      `Estou online. ${dayGreeting}! Como posso te ajudar agora?`,
      `Presente por aqui. ${dayGreeting}! Como posso te ajudar agora?`,
    ], normalized.length);
  }

  if (checkinDetected) {
    return pickVariant(state, [
      `Tudo bem por aqui. ${dayGreeting}! Como posso te ajudar agora?`,
      `Tudo certo por aqui. ${dayGreeting}! Como posso te ajudar agora?`,
      `Tudo tranquilo por aqui. ${dayGreeting}! Como posso te ajudar agora?`,
    ], normalized.length);
  }

  if (family === "greeting_formal") {
    return pickVariant(state, [
      `${dayGreeting}. Em que posso te ajudar agora?`,
      `${dayGreeting}. Como posso te ajudar agora?`,
      `${dayGreeting}. Diga como prefere seguir.`,
    ], normalized.length);
  }

  if (family === "greeting_reentry") {
    return pickVariant(state, [
      `${dayGreeting}! Que bom te ver de novo. Como posso te ajudar agora?`,
      `${dayGreeting}! Que bom te ver de volta. Como posso te ajudar agora?`,
      `${dayGreeting}! Vamos continuar. Como posso te ajudar agora?`,
    ], normalized.length);
  }

  if (family === "greeting_timebound") {
    return pickVariant(state, [
      `${dayGreeting}! Como posso te ajudar agora?`,
      `${dayGreeting}! Como posso te ajudar hoje?`,
      `${dayGreeting}! Em que posso te ajudar agora?`,
    ], normalized.length);
  }

  if (greetingDetected) {
    return pickVariant(state, [
      `${dayGreeting}! Como posso te ajudar agora?`,
      `${dayGreeting}! Em que posso te ajudar agora?`,
      `${dayGreeting}! Diga como posso te ajudar.`,
      `${dayGreeting}! Como você quer seguir?`,
    ], normalized.length);
  }

  return null;
}

function buildNameIntentResponse(text: string): string | null {
  if (isNameSharePrompt(text)) {
    return "Claro. Qual nome você quer que eu use para te chamar?";
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
    const scoped = buildPersonaIdentityScopedResponse(normalizedFocus);
    if (scoped) {
      const identityLead = ensureFirstPersonIdentityLead(scoped);
      return knownName ? `${identityLead} E lembro de você, ${knownName}.` : identityLead;
    }
    return knownName
      ? `Eu sou a Letícia. E lembro de você, ${knownName}.`
      : "Eu sou a Letícia. Estou aqui para te ajudar.";
  }
  if (isPersonaNameOriginPrompt(normalizedFocus)) {
    const scoped = buildPersonaIdentityScopedResponse(normalizedFocus);
    return ensureNameOriginGrounding(scoped || "Eu sou a Letícia.");
  }
  if (isPersonaCreatorPrompt(normalizedFocus)) {
    const scoped = buildPersonaIdentityScopedResponse(normalizedFocus);
    return ensureCreatorContextGrounding(
      scoped || "No contexto desta IA, Medeiros é o idealizador do projeto Letícia.",
    );
  }
  if (isCreatorExpansionPrompt(normalizedFocus) && hasRecentCreatorContext(state)) {
    const scoped = buildPersonaIdentityScopedResponse(normalizedFocus);
    return ensureCreatorBiographyGuard(ensureCreatorContextGrounding(
      scoped || "No contexto desta IA, Medeiros é o idealizador do projeto Letícia.",
    ));
  }

  if (isNameRecallPrompt(normalizedFocus)) {
    return knownName
      ? `Eu lembro sim. Seu nome é ${knownName}.`
      : 'Eu ainda não tenho seu nome salvo nesta conversa. Se quiser, me diga "me chame de ...".';
  }

  if (isNameSharePrompt(normalizedFocus)) {
    return "Claro. Qual nome você quer que eu use para te chamar?";
  }

  if (isSmallTalkMessage(normalizedFocus)) {
    if (knownName) return `Tudo certo por aqui, ${knownName}. Como posso te ajudar agora?`;
    return "Tudo certo por aqui. Como posso te ajudar agora?";
  }

  return "Entendi. Para eu responder com precisão, me diga em uma frase o que você quer que eu faça agora.";
}

export function buildConversationalFallback(state: ProcessingState): string | null {
  const focus = extractLatestUtterance(state.normalizedMessage);
  if (!focus) return null;
  const normalizedFocus = normalize(focus);
  const identityOrPersonalCue =
    isPersonaIdentityPrompt(normalizedFocus) ||
    isPersonaNameOriginPrompt(normalizedFocus) ||
    isPersonaCreatorPrompt(normalizedFocus) ||
    (isCreatorExpansionPrompt(normalizedFocus) && hasRecentCreatorContext(state)) ||
    isNameRecallPrompt(normalizedFocus) ||
    isNameSharePrompt(normalizedFocus);
  const conversationalRouteEligible =
    state.selectedMode === "chat" ||
    state.userProfile.conversationalPrompt === true ||
    isConversationalPrompt(state.normalizedMessage) ||
    isGreetingMessage(normalizedFocus) ||
    isSmallTalkMessage(normalizedFocus);
  if (!conversationalRouteEligible && !identityOrPersonalCue) return null;

  const resolvedIntent =
    typeof state.userProfile.resolvedIntent === "string"
      ? state.userProfile.resolvedIntent
      : "chat";
  const isChatMode =
    state.selectedMode === "chat" ||
    resolvedIntent === "chat" ||
    isConversationalPrompt(state.normalizedMessage);
  if (!isChatMode) return null;
  if (isTechnicalRequest(focus)) return buildTechnicalClarificationResponse(focus);
  if (isVerifiableFactQuestion(focus)) return null;
  if (isReferentialFactualPrompt(focus) && hasRecentFactualAnchor(state)) return null;
  if (isResearchRequest(focus)) return null;

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
    return `Eu lembro sim. Seu nome é ${resolvedName}.`;
  }
  if (asksNameRecall) {
    return 'Eu ainda não tenho seu nome salvo nesta conversa. Se quiser, me diga "me chame de ...".';
  }

  const nameIntent = buildNameIntentResponse(focus);
  if (nameIntent) return nameIntent;

  if (isPersonaIdentityPrompt(normalizedFocus)) {
    const scoped = buildPersonaIdentityScopedResponse(normalizedFocus);
    if (scoped) {
      const identityLead = ensureFirstPersonIdentityLead(scoped);
      return knownName ? `${identityLead} E lembro de você, ${knownName}.` : identityLead;
    }
    if (knownName) return `Eu sou a Letícia. E lembro de você, ${knownName}.`;
    return "Eu sou a Letícia. Estou aqui para te ajudar.";
  }
  if (isPersonaNameOriginPrompt(normalizedFocus)) {
    const scoped = buildPersonaIdentityScopedResponse(normalizedFocus);
    return ensureNameOriginGrounding(scoped || "Eu sou a Letícia.");
  }
  if (isPersonaCreatorPrompt(normalizedFocus)) {
    const scoped = buildPersonaIdentityScopedResponse(normalizedFocus);
    return ensureCreatorContextGrounding(
      scoped || "No contexto desta IA, Medeiros é o idealizador do projeto Letícia.",
    );
  }
  if (isCreatorExpansionPrompt(normalizedFocus) && hasRecentCreatorContext(state)) {
    const scoped = buildPersonaIdentityScopedResponse(normalizedFocus);
    return ensureCreatorBiographyGuard(ensureCreatorContextGrounding(
      scoped || "No contexto desta IA, Medeiros é o idealizador do projeto Letícia.",
    ));
  }

  if (declaredName) {
    return `Perfeito, ${declaredName}. Eu vou te chamar assim daqui pra frente.`;
  }

  const greeting = buildGreetingResponse(state, normalizedFocus);
  if (greeting) return greeting;

  if (isRedoCommand(focus)) {
    return "Posso refazer agora. Me diga exatamente o que devo buscar (ex.: 'nome do presidente do Brasil').";
  }

  if (focus.length <= 180 || isConversationalPrompt(focus)) {
    if (knownName) {
      return `${knownName}, para eu responder com precisão, me diga em uma frase o que você quer que eu faça agora.`;
    }
    return "Para eu responder com precisão, me diga em uma frase o que você quer que eu faça agora.";
  }

  return null;
}

