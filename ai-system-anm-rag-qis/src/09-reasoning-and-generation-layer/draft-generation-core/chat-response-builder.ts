import type { ProcessingState } from "../../bridges/contracts/processing-state";

function normalize(value: string): string {
  return `${value || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s?!.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTechnicalRequest(text: string): boolean {
  return /\b(api|endpoint|typescript|javascript|python|sql|docker|stack trace|bug|debug|migrat|pipeline)\b/i.test(text);
}

function extractLatestUtterance(text: string): string {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^pensou por \d+ms$/i.test(normalize(line)));

  if (!lines.length) return text.trim();

  const deduped: string[] = [];
  let lastKey = "";
  for (const line of lines) {
    const key = normalize(line);
    if (key && key === lastKey) continue;
    deduped.push(line);
    lastKey = key;
  }

  return deduped[deduped.length - 1] || lines[lines.length - 1];
}

export function resolveConversationFocus(text: string): string {
  return extractLatestUtterance(text || "");
}

function toDisplayName(value: string): string {
  const trimmed = value.trim().replace(/[.,!?;:]+$/g, "");
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/g)
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractPreferredName(text: string): string | null {
  const cleaned = text.trim();
  const patterns = [
    /(?:meu nome (?:e|eh)|my name is)\s+([A-Za-z][A-Za-z' -]{1,48})/i,
    /(?:pode (?:passar a )?me chamar de|me chame de|chame-me de|call me)\s+([A-Za-z][A-Za-z' -]{1,48})/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (!match?.[1]) continue;

    const candidate = match[1]
      .replace(/\b(de agora em diante|a partir de agora)\b/gi, "")
      .trim();
    const display = toDisplayName(candidate);
    if (display) return display;
  }

  return null;
}

function extractKnownNameFromTurns(turns: Array<{ role: "user" | "assistant"; content: string }>): string | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const content = turns[index]?.content || "";
    const userProvided = extractPreferredName(content);
    if (userProvided) return userProvided;

    const assistantAck = content.match(/perfeito,\s*([A-Za-z][A-Za-z' -]{1,48})/i)?.[1];
    if (assistantAck) {
      const display = toDisplayName(assistantAck);
      if (display) return display;
    }
  }
  return null;
}

function buildGreetingResponse(normalized: string): string | null {
  if (/^(oi|oii|ola|olaa|hello|hi|hey|e ai|eae)$/.test(normalized)) {
    return "Oi! Tudo bem? Como posso te ajudar agora?";
  }

  if (/^(tudo bem\??|como vc esta\??|como voce esta\??|como vai\??)$/.test(normalized)) {
    return "Estou bem e pronto para ajudar. O que voce precisa agora?";
  }

  return null;
}

function buildNameIntentResponse(text: string): string | null {
  const normalized = normalize(text);

  if (/\b(posso te dizer meu nome|pode te dizer meu nome|posso falar meu nome|quer saber meu nome)\b/i.test(normalized)) {
    return "Claro, pode sim. Qual nome voce quer que eu use?";
  }

  return null;
}

function isNameRecallQuestion(text: string): boolean {
  return /\b(qual (e|eh)? o meu nome|qual meu nome|vc pode me dizer( entao)? qual o meu nome|como voce me chama|como vc me chama)\b/i
    .test(text);
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
    candidateNormalized.includes(referenceNormalized) &&
    candidateNormalized.length <= Math.ceil(referenceNormalized.length * 1.5)
  ) {
    return true;
  }

  return tokenOverlapRatio(candidateNormalized, referenceNormalized) >= 0.9;
}

export function buildConversationalFallback(state: ProcessingState): string | null {
  const resolvedIntent =
    typeof state.userProfile.resolvedIntent === "string"
      ? state.userProfile.resolvedIntent
      : "chat";
  const isChatMode = state.selectedMode === "chat" || resolvedIntent === "chat";
  if (!isChatMode) return null;

  const focus = extractLatestUtterance(state.normalizedMessage);
  if (!focus) return null;
  if (isTechnicalRequest(focus)) return null;

  const nameIntent = buildNameIntentResponse(focus);
  if (nameIntent) return nameIntent;

  const preferredNameFromFocus = extractPreferredName(focus);
  if (preferredNameFromFocus) {
    state.userProfile = {
      ...state.userProfile,
      preferredName: preferredNameFromFocus,
    };
    return `Perfeito, ${preferredNameFromFocus}. Vou te chamar assim de agora em diante.`;
  }

  const knownName =
    (typeof state.userProfile.preferredName === "string" && toDisplayName(state.userProfile.preferredName)) ||
    extractKnownNameFromTurns(state.recentTurns);
  if (knownName && isNameRecallQuestion(normalize(focus))) {
    state.userProfile = {
      ...state.userProfile,
      preferredName: knownName,
    };
    return `Seu nome e ${knownName}.`;
  }
  if (!knownName && isNameRecallQuestion(normalize(focus))) {
    return 'Ainda nao tenho seu nome salvo nesta conversa. Se quiser, me diga "me chame de ...".';
  }

  const greeting = buildGreetingResponse(normalize(focus));
  if (greeting) return greeting;

  if (focus.length <= 180) {
    return "Entendi. Me diz exatamente o que voce quer que eu faca e eu respondo de forma objetiva.";
  }

  return null;
}
