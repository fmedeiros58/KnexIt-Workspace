/**
 * Responsabilidade do arquivo:
 * - Orquestrar o modulo 18 completo (adapters -> serializers -> stream -> delivery).
 * - Produzir payload final por canal/formato com fallback seguro para rest/plain-text.
 * - Registrar diagnostico operacional do modulo no executionArtifacts e no trace.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { isGreetingMessage } from "../shared/utils/conversation-signals";
import type { DeliveryChannel, DeliveryFormat, PresentationRenderModel, SerializedPresentation } from "./presentation-contracts";
import { isHttpUrl } from "./presentation-contracts";
import { ensureUtf8Response } from "./text-encoding-guard";
import { markdownSerializer } from "./output-serializer/markdown-serializer";
import { plainTextSerializer } from "./output-serializer/plain-text-serializer";
import { jsonBlockSerializer } from "./output-serializer/json-block-serializer";
import { richTextSerializer } from "./output-serializer/rich-text-serializer";
import { chatBubbleAdapter } from "./ui-render-adapter/chat-bubble-adapter";
import { citationAdapter } from "./ui-render-adapter/citation-adapter";
import { codeBlockAdapter } from "./ui-render-adapter/code-block-adapter";
import { confidenceAdapter } from "./ui-render-adapter/confidence-adapter";
import { documentBlockAdapter } from "./ui-render-adapter/document-block-adapter";
import { mediaAdapter } from "./ui-render-adapter/media-adapter";
import { buildPresentationFrontDelivery } from "./presentation-front-bridge";
import { buildPresentationStream } from "./presentation-stream-bridge";
import {
  applyHeadingAndListStrategy,
  buildResponseLayoutPlan,
  resolveCitationRequestContext,
  textualOutputAuditor,
} from "./textual-layout-engine";

type SupportedOutputLanguage = "pt-BR" | "en-US" | "es-ES" | "unknown";

type RequestedLanguageDirective = {
  language: SupportedOutputLanguage;
  explicitDirective: boolean;
};

type PresentationLanguageGuardResult = {
  text: string;
  targetLanguage: SupportedOutputLanguage;
  detectedLanguage: SupportedOutputLanguage;
  requestedLanguage: SupportedOutputLanguage | null;
  surfaceLanguage: SupportedOutputLanguage;
  applied: boolean;
  reason: string;
};

type HardBanResult = {
  text: string;
  replacedCount: number;
};

type PresentationWatchdogResult = {
  text: string;
  triggered: boolean;
  issues: string[];
  surfaceBefore: SupportedOutputLanguage;
  surfaceAfter: SupportedOutputLanguage;
  promptEchoDetected: boolean;
  mixedLanguageDetected: boolean;
};

const PT_SURFACE_MARKERS: ReadonlyArray<string> = [
  "voce",
  "nao",
  "como",
  "porque",
  "quem",
  "criou",
  "entao",
  "isso",
  "aqui",
  "mesmo",
  "sentido",
  "criacao",
  "inteligencia",
  "resposta",
  "portugues",
  "projeto",
  "idealizador",
  "origem",
];

const EN_SURFACE_MARKERS: ReadonlyArray<string> = [
  "based on the context",
  "i understand",
  "you are not",
  "literal",
  "biological",
  "metaphorical",
  "figurative",
  "collaboration",
  "artificial intelligence",
  "created by",
];

const ES_SURFACE_MARKERS: ReadonlyArray<string> = [
  "entonces",
  "usted",
  "gracias",
  "hola",
  "por favor",
  "espanol",
  "quiero",
  "puedo",
];

const EN_TO_PT_LEAK_REPAIRS: ReadonlyArray<[RegExp, string]> = [
  [/\bbased on the context you have provided multiple times\b/gi, "Pelo contexto que você trouxe várias vezes"],
  [/\bbased on the context provided\b/gi, "Pelo contexto fornecido"],
  [/\bi understand that\b/gi, "eu entendo que"],
  [/\byou are not referring to it in a literal or biological sense\b/gi, "você não está se referindo a isso em sentido literal ou biológico"],
  [/\bbut rather in a metaphorical or figurative sense(?: of creation or collaboration)?\b/gi, "mas sim em sentido metafórico de criação"],
  [/\bi am an artificial intelligence created by medeiros\b/gi, "eu sou uma inteligência artificial criada por Medeiros"],
  [/\bi do not possess biological attributes\b/gi, "eu não possuo atributos biológicos"],
  [/\bi, leticia the ai,\b/gi, "eu, Letícia, a IA,"],
  [/\byou and leticia\b/gi, "você e Letícia"],
];

const PT_SURFACE_REPAIRS: ReadonlyArray<[RegExp, string]> = [
  [/\bquem criou mim\b/gi, "quem me criou"],
  [/\bcriou mim\b/gi, "me criou"],
  [/\bmeu nome\s+[eé]\s+ofereci\b/gi, "sobre meu nome e ofereci"],
  [/\bnome\s+[eé]\s+ofereci\b/gi, "nome e ofereci"],
  [/\beu respondi a pergunta sobre meu nome e ofereci explicar\b/gi, "eu respondi sobre meu nome e ofereci explicar"],
  [/\bleticia aqui,\s*a ia\b/gi, "Letícia aqui"],
  [/\bnao ha evidencias especificas no contexto atual\b/gi, "no contexto atual, há evidências limitadas"],
];

const PT_LEXICAL_MARKERS = new Set([
  "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos", "e", "em", "entre", "essa", "esse",
  "esta", "este", "ha", "mas", "na", "nas", "nao", "no", "nos", "o", "os", "ou", "para", "por", "porque", "qual",
  "quando", "que", "quem", "se", "sem", "ser", "sua", "suas", "uma", "um", "bem", "estar", "agregado", "liberdade",
  "coletiva", "decisao", "principio", "principios", "resposta", "regra", "universal", "inocente",
]);

const EN_LEXICAL_MARKERS = new Set([
  "a", "an", "and", "any", "applied", "are", "as", "at", "basic", "be", "between", "can", "collective", "decision",
  "do", "every", "first", "for", "freedom", "from", "in", "is", "let", "must", "no", "now", "of", "or", "possible",
  "question", "rule", "show", "suppose", "system", "that", "the", "their", "then", "these", "to", "under",
  "universal", "well", "without",
]);

const ES_LEXICAL_MARKERS = new Set([
  "al", "con", "como", "de", "del", "el", "en", "es", "esta", "este", "hola", "la", "las", "los", "para", "pero",
  "por", "que", "se", "sin", "sobre", "una", "uno", "usted",
]);

const EN_TO_PT_STRUCTURAL_REPAIRS: ReadonlyArray<[RegExp, string]> = [
  [/\bto address the question\b/gi, "Para responder à pergunta"],
  [/\blet'?s first clarify some concepts\b/gi, "primeiro vou esclarecer alguns conceitos"],
  [/\bnow,? let'?s analyze the problem statement\b/gi, "Agora, vamos analisar o problema"],
  [/\bprinciple\b/gi, "Princípio"],
  [/\bobligatory normative principle\b/gi, "Princípio normativo obrigatório"],
  [/\bbasic freedom\b/gi, "liberdade básica"],
  [/\bcollective decision\b/gi, "decisão coletiva"],
  [/\baggregate well[- ]being\b/gi, "bem-estar agregado"],
  [/\buniversal rule\b/gi, "regra universal"],
  [/\bwithout exception\b/gi, "sem exceção"],
  [/\bunder certain circumstances\b/gi, "em certas circunstâncias"],
  [/\bany possible decision\b/gi, "qualquer decisão possível"],
  [/\bviolates at least one of these principles\b/gi, "viola ao menos um desses princípios"],
  [/\bmust maximize\b/gi, "deve maximizar"],
  [/\bmust be justifiable by\b/gi, "deve ser justificável por"],
  [/\bthe conflict between the three principles is inevitable\b/gi, "o conflito entre os três princípios pode ser inevitável"],
];

const EN_TO_PT_TOKEN_REPAIRS: ReadonlyArray<[RegExp, string]> = [
  [/\bconsider\b/gi, "considere"],
  [/\bhypothetical\b/gi, "hipotético"],
  [/\bsystem\b/gi, "sistema"],
  [/\bprinciples?\b/gi, "princípios"],
  [/\bcan\b/gi, "pode"],
  [/\breduce\b/gi, "reduzir"],
  [/\bbasic\b/gi, "básica"],
  [/\bfreedom\b/gi, "liberdade"],
  [/\binnocent\b/gi, "inocente"],
  [/\bindividual\b/gi, "indivíduo"],
  [/\bevery\b/gi, "toda"],
  [/\bmust\b/gi, "deve"],
  [/\bmaximize\b/gi, "maximizar"],
  [/\bjustifiable\b/gi, "justificável"],
  [/\bapplied\b/gi, "aplicada"],
  [/\brule\b/gi, "regra"],
  [/\bquestion\b/gi, "pergunta"],
  [/\bclarify\b/gi, "esclarecer"],
  [/\bconcepts?\b/gi, "conceitos"],
];

function escapeRegex(value: string) {
  return `${value || ""}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseChannel(value: string | undefined): DeliveryChannel | null {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (normalized === "rest" || normalized === "sse" || normalized === "websocket") {
    return normalized;
  }
  return null;
}

function parseFormat(value: string | undefined): DeliveryFormat | null {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (normalized === "plain-text" || normalized === "markdown" || normalized === "json-block" || normalized === "rich-text") {
    return normalized;
  }
  return null;
}

function resolveDeliveryChannel(): DeliveryChannel {
  return parseChannel(process.env.KNX_PRESENTATION_CHANNEL) || "rest";
}

function resolveDeliveryFormat(channel: DeliveryChannel, hasCodeBlocks: boolean): DeliveryFormat {
  const explicit = parseFormat(process.env.KNX_PRESENTATION_FORMAT);
  if (explicit) return explicit;
  if (channel === "websocket") return "json-block";
  if (hasCodeBlocks) return "markdown";
  return "plain-text";
}

function selectSerialized(
  format: DeliveryFormat,
  serialized: Record<DeliveryFormat, SerializedPresentation>,
): SerializedPresentation {
  return serialized[format] || serialized["plain-text"];
}

function normalizeLanguageProbe(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveKnownLanguageTag(value: string | undefined): SupportedOutputLanguage {
  const normalized = normalizeLanguageProbe(value || "");
  if (!normalized) return "unknown";
  if (normalized.startsWith("pt")) return "pt-BR";
  if (normalized.startsWith("en")) return "en-US";
  if (normalized.startsWith("es")) return "es-ES";
  if (/\b(portugues|portuguese|pt-br|ptbr)\b/.test(normalized)) return "pt-BR";
  if (/\b(ingles|english|en-us|enus)\b/.test(normalized)) return "en-US";
  if (/\b(espanhol|espanol|spanish|es-es|eses)\b/.test(normalized)) return "es-ES";
  return "unknown";
}

function detectRequestedLanguageDirective(message: string): RequestedLanguageDirective | null {
  const normalized = normalizeLanguageProbe(message);
  if (!normalized) return null;

  const hasDirectiveVerb =
    /\b(responda|fale|escreva|devolva|traga|answer|reply|write|respond|responde|habla)\b/.test(normalized) ||
    /\b(reply in|answer in|responda em|fale em|escreva em)\b/.test(normalized);

  if (/\b(portugues|portuguese|pt-br|ptbr)\b/.test(normalized)) {
    return { language: "pt-BR", explicitDirective: hasDirectiveVerb };
  }
  if (/\b(ingles|english|en-us|enus)\b/.test(normalized)) {
    return { language: "en-US", explicitDirective: hasDirectiveVerb };
  }
  if (/\b(espanhol|espanol|spanish|es-es|eses)\b/.test(normalized)) {
    return { language: "es-ES", explicitDirective: hasDirectiveVerb };
  }
  return null;
}

function isLikelyPortugueseInput(message: string): boolean {
  const normalized = normalizeLanguageProbe(message);
  if (!normalized) return false;

  const hardPtSignals = [
    " qual ",
    " como ",
    " por que ",
    " porque ",
    " voce ",
    " nao ",
    " para ",
    " com ",
    " entre ",
    " liberdade ",
    " decisao ",
    " principios ",
    " resposta ",
    " nenhuma ",
    " coletiva ",
    " individuo ",
    " bem estar ",
    " suponha ",
    " faca ",
    " mostre ",
    " reformule ",
    " explicite ",
    " sem recorrer ",
  ];

  let score = 0;
  for (const signal of hardPtSignals) {
    if (normalized.includes(signal.trim())) score += 1;
  }
  if (/\b(que|como|qual|quem|porque|por que)\b/.test(normalized)) score += 2;
  if (/\b(voce|nao|entao|ainda|preciso|quero)\b/.test(normalized)) score += 2;
  if (/\b(english|espanol|spanish|ingles|espanhol)\b/.test(normalized)) score -= 3;

  return score >= 3;
}

function countSurfaceMarkerHits(text: string, markers: ReadonlyArray<string>) {
  let total = 0;
  for (const marker of markers) {
    const escaped = escapeRegex(marker);
    const pattern = new RegExp(`\\b${escaped}\\b`, "g");
    const matches = text.match(pattern);
    if (matches?.length) total += matches.length;
  }
  return total;
}

function tokenizeLexicalWords(text: string) {
  return normalizeLanguageProbe(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/g)
    .filter((token) => token.length >= 2);
}

function countLexicalMarkerHits(tokens: string[], lexicon: Set<string>) {
  let total = 0;
  for (const token of tokens) {
    if (lexicon.has(token)) total += 1;
  }
  return total;
}

function estimateLanguageEvidence(text: string) {
  const normalized = normalizeLanguageProbe(text);
  const tokens = tokenizeLexicalWords(normalized);
  const markerPt = countSurfaceMarkerHits(normalized, PT_SURFACE_MARKERS);
  const markerEn = countSurfaceMarkerHits(normalized, EN_SURFACE_MARKERS);
  const markerEs = countSurfaceMarkerHits(normalized, ES_SURFACE_MARKERS);
  const lexicalPt = countLexicalMarkerHits(tokens, PT_LEXICAL_MARKERS);
  const lexicalEn = countLexicalMarkerHits(tokens, EN_LEXICAL_MARKERS);
  const lexicalEs = countLexicalMarkerHits(tokens, ES_LEXICAL_MARKERS);

  return {
    tokenCount: tokens.length,
    ptScore: markerPt * 3 + lexicalPt,
    enScore: markerEn * 3 + lexicalEn,
    esScore: markerEs * 3 + lexicalEs,
  };
}

function detectSurfaceLanguage(text: string): SupportedOutputLanguage {
  const evidence = estimateLanguageEvidence(text);
  if (evidence.tokenCount === 0) return "unknown";
  const scores = [
    { language: "pt-BR" as const, score: evidence.ptScore },
    { language: "en-US" as const, score: evidence.enScore },
    { language: "es-ES" as const, score: evidence.esScore },
  ].sort((a, b) => b.score - a.score);

  if (scores[0].score <= 1) return "unknown";
  const margin = scores[0].score - scores[1].score;
  if (margin < 2 && evidence.tokenCount >= 8) return "unknown";
  return scores[0].language;
}

function hasStrongMixedLanguageEvidence(text: string, target: SupportedOutputLanguage) {
  const evidence = estimateLanguageEvidence(text);
  const targetScore =
    target === "pt-BR" ? evidence.ptScore : target === "en-US" ? evidence.enScore : target === "es-ES" ? evidence.esScore : 0;
  const otherScores = [evidence.ptScore, evidence.enScore, evidence.esScore].filter((score, index) => {
    if (target === "pt-BR") return index !== 0;
    if (target === "en-US") return index !== 1;
    if (target === "es-ES") return index !== 2;
    return true;
  });
  const strongestOther = Math.max(0, ...otherScores);
  if (target === "unknown") return strongestOther >= 6;
  return targetScore >= 4 && strongestOther >= 4 && strongestOther / Math.max(1, targetScore) >= 0.55;
}

function hasResidualEnglishLeakForPortuguese(text: string) {
  const normalized = normalizeLanguageProbe(text);
  if (!normalized) return false;
  const evidence = estimateLanguageEvidence(normalized);
  const hardLeak = /\b(with|of|that|which|this|these|those|three|obligatory|normative|clarify|concepts|problem statement)\b/.test(
    normalized,
  );
  if (hardLeak) return true;
  return evidence.enScore >= 5 && evidence.enScore >= evidence.ptScore * 0.45;
}

function hasKnownEnglishLeak(text: string) {
  const normalized = normalizeLanguageProbe(text);
  if (!normalized) return false;
  return /\b(based on the context|you are not referring|literal or biological|metaphorical|figurative|i am an artificial intelligence)\b/.test(
    normalized,
  );
}

function isLikelyIdentityPrompt(state: ProcessingState) {
  const normalized = normalizeLanguageProbe(state.normalizedMessage || state.rawMessage || "");
  if (!normalized) return false;
  return /\b(leticia|medeiros|nome|origem|chamam|criacao|criador|idealizador|filha)\b/.test(normalized);
}

function resolveIdentityNarrativeFallback(state: ProcessingState) {
  const aiIdentity = state.behaviorPersonalityState?.aiIdentity;
  if (!aiIdentity) return "";
  const hasIdentitySignal =
    aiIdentity.identityQuestionDetected ||
    aiIdentity.nameOriginQuestionDetected ||
    Boolean(aiIdentity.creatorQuestionDetected) ||
    Boolean(aiIdentity.founderInfluenceQuestionDetected) ||
    Boolean(aiIdentity.formationQuestionDetected) ||
    Boolean(aiIdentity.professionalQuestionDetected) ||
    isLikelyIdentityPrompt(state);
  if (!hasIdentitySignal) return "";
  return `${aiIdentity.medeirosNarrativeShort || aiIdentity.identityNarrativeShort || ""}`.trim();
}

function repairCommonEnglishLeakToPortuguese(text: string) {
  let repaired = `${text || ""}`;
  for (const [pattern, replacement] of EN_TO_PT_LEAK_REPAIRS) {
    repaired = repaired.replace(pattern, replacement);
  }
  repaired = repaired
    .replace(/\bi am\b/gi, "eu sou")
    .replace(/\bi do not\b/gi, "eu não")
    .replace(/\byou are\b/gi, "você está")
    .replace(/\byou have\b/gi, "você trouxe")
    .replace(/\bcreated by\b/gi, "criada por")
    .replace(/\bartificial intelligence\b/gi, "inteligência artificial")
    .replace(/\s+/g, " ")
    .trim();
  return repaired;
}

function applyEnglishStructuralRepairsForPortuguese(text: string) {
  let repaired = `${text || ""}`;
  for (const [pattern, replacement] of EN_TO_PT_STRUCTURAL_REPAIRS) {
    repaired = repaired.replace(pattern, replacement);
  }
  repaired = repaired
    .replace(/\bmust\b/gi, "deve")
    .replace(/\bshould\b/gi, "deve")
    .replace(/\bcan\b/gi, "pode")
    .replace(/\bnow\b/gi, "agora")
    .replace(/\s+/g, " ")
    .trim();
  return repaired;
}

function applyEnglishTokenRepairsForPortuguese(text: string) {
  let repaired = `${text || ""}`;
  for (const [pattern, replacement] of EN_TO_PT_TOKEN_REPAIRS) {
    repaired = repaired.replace(pattern, replacement);
  }
  repaired = repaired
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
  return repaired;
}

function normalizeForEchoCheck(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string) {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isPromptEcho(answer: string, prompt: string) {
  const normalizedAnswer = normalizeForEchoCheck(answer);
  const normalizedPrompt = normalizeForEchoCheck(prompt);
  if (!normalizedAnswer || !normalizedPrompt) return false;

  if (
    /\b(the problem statement describes|please do the following|let me clarify some concepts|consider a hypothetical social system)\b/i.test(
      answer,
    )
  ) {
    return true;
  }

  const promptSlice = normalizedPrompt.slice(0, Math.min(260, normalizedPrompt.length));
  if (promptSlice.length >= 120 && normalizedAnswer.includes(promptSlice)) return true;

  const promptTokens = normalizedPrompt.split(" ").filter((token) => token.length >= 4);
  const answerTokens = normalizedAnswer.split(" ").filter((token) => token.length >= 4);
  if (promptTokens.length < 12 || answerTokens.length < 12) return false;
  const promptSet = new Set(promptTokens);
  const answerSet = new Set(answerTokens);
  let overlap = 0;
  for (const token of promptSet) {
    if (answerSet.has(token)) overlap += 1;
  }
  const coverage = overlap / Math.max(1, promptSet.size);
  const lengthRatio = normalizedAnswer.length / Math.max(1, normalizedPrompt.length);
  return coverage >= 0.7 && lengthRatio >= 0.55 && lengthRatio <= 1.95;
}

function stripPromptEcho(answer: string, prompt: string) {
  const paragraphs = `${answer || ""}`
    .split(/\n{2,}/g)
    .map((row) => row.trim())
    .filter(Boolean);
  if (!paragraphs.length) return `${answer || ""}`.trim();

  let removed = 0;
  while (paragraphs.length > 1 && isPromptEcho(paragraphs[0], prompt)) {
    paragraphs.shift();
    removed += 1;
  }

  let cleaned = paragraphs.join("\n\n").trim();
  cleaned = cleaned.replace(/^["“](.{100,}?)["”]\s*/i, "").trim();
  if (removed === 0 && !cleaned) return `${answer || ""}`.trim();
  return cleaned || `${answer || ""}`.trim();
}

function stripRoleTranscriptTail(answer: string, prompt: string) {
  const source = `${answer || ""}`.trim();
  if (!source) return "";

  const roleTailPattern = /\b(?:usu[aá]rio|user|assistente|assistant|leticia|let[ií]cia)\s*:\s*/i;
  const roleMatch = roleTailPattern.exec(source);
  if (!roleMatch || roleMatch.index <= 0) return source;

  const head = source.slice(0, roleMatch.index).trim();
  const tail = source.slice(roleMatch.index).trim();
  if (!head || !tail) return source;
  const normalizedPrompt = normalizeForEchoCheck(prompt);
  const promptWords = normalizedPrompt.split(" ").filter(Boolean);
  const shortIdentityPrompt =
    promptWords.length <= 12 &&
    /\b(nome|seu nome|teu nome|quem e voce|quem e vc|how are you called|what is your name)\b/.test(normalizedPrompt);

  const tailLooksLikeEcho =
    isPromptEcho(tail, prompt) ||
    /\b(considere|consider a|without initially|agora suponha|fa[cç]a o seguinte|do the following|let me clarify)\b/i.test(
      normalizeForEchoCheck(tail),
    );
  if (!tailLooksLikeEcho && !(shortIdentityPrompt && tail.length >= 28)) return source;
  return head.replace(/\s+([,.!?;:])/g, "$1").trim();
}

function filterSentencesToTargetLanguage(text: string, target: SupportedOutputLanguage) {
  const sentences = splitSentences(text);
  if (!sentences.length || target === "unknown") return `${text || ""}`.trim();

  const kept: string[] = [];
  let removed = 0;
  for (const sentence of sentences) {
    const evidence = estimateLanguageEvidence(sentence);
    const dominant = detectSurfaceLanguage(sentence);
    if (
      (target === "pt-BR" && dominant === "en-US" && evidence.enScore >= evidence.ptScore + 1) ||
      (target === "pt-BR" && evidence.enScore >= 5 && evidence.enScore >= evidence.ptScore * 0.7) ||
      (target === "en-US" && dominant === "pt-BR" && evidence.ptScore >= evidence.enScore + 1) ||
      (target === "es-ES" && dominant !== "unknown" && dominant !== "es-ES")
    ) {
      removed += 1;
      continue;
    }
    kept.push(sentence);
  }

  if (!kept.length || removed === 0) return `${text || ""}`.trim();
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

function applyPortugueseSurfaceRepairs(text: string) {
  let repaired = `${text || ""}`;
  for (const [pattern, replacement] of PT_SURFACE_REPAIRS) {
    repaired = repaired.replace(pattern, replacement);
  }
  repaired = repaired
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
  return repaired;
}

function isFollowUpTurn(state: ProcessingState) {
  return (state.conversationState.turnCount || 0) > 0 || (state.recentTurns?.length || 0) > 0;
}

function stripContinuationGreeting(state: ProcessingState, text: string) {
  const source = `${text || ""}`.trim();
  if (!source) return source;

  const prompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const greetingLeakPattern =
    /^\s*(?:ol[aá]|oi+|oie+|opa+|bom dia|boa tarde|boa noite)\s*(?:[,!.\-–—:]|\s)*\s*(?:usu[aá]rio(?:\s+carinho)?|carinho)?\s*[!,.:\-–—\s]*/i;
  const hasGreetingLeakPrefix = greetingLeakPattern.test(source);
  const followUpTurn = isFollowUpTurn(state);
  const promptIsGreeting = isGreetingMessage(prompt);

  if (promptIsGreeting) return source;
  if (!followUpTurn && !hasGreetingLeakPrefix) return source;

  const cleaned = source.replace(greetingLeakPattern, "").trim();
  return cleaned || source;
}

function removeContextArtifactPhrases(text: string) {
  let cleaned = `${text || ""}`.trim();
  if (!cleaned) return cleaned;

  const replacements: ReadonlyArray<[RegExp, string]> = [
    [/^\s*(?:nesse|neste)\s+contexto\s*,\s*/i, ""],
    [/\bno contexto (?:desta|desse|deste)\s+(?:ia|projeto|sistema|arquitetura)\b/gi, "nesta estrutura"],
    [/\bdentro do contexto (?:desta|desse|deste)\s+(?:ia|projeto|sistema|arquitetura)\b/gi, "nesta estrutura"],
    [/\bno contexto do ai-system-anm\b/gi, "no ai-system-anm"],
    [/\bpelo contexto (?:fornecido|que voc[eê] trouxe(?: [^,.!?]*)?)\b/gi, "pelo que você trouxe"],
    [/\bcom base no contexto (?:fornecido|atual)\b/gi, "com base no que foi apresentado"],
    [/\bnao ha evidencias especificas no contexto atual\b/gi, "há evidências limitadas no momento"],
    [/\bno contexto atual\b/gi, "neste momento"],
    [/(^|\n)\s*(?:leitura|sintese|s[ií]ntese)\s+l[oó]gico-?pr[aá]tica\s*:\s*/gim, "$1"],
    [/(^|\n)\s*quadro\s+l[oó]gico-?pr[aá]tico\s*(?:\(obrigat[oó]rio\))?\s*:\s*/gim, "$1"],
  ];

  for (const [pattern, replacement] of replacements) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  cleaned = cleaned
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,.!?;:])\1+/g, "$1")
    .trim();

  return cleaned;
}

function applyBackendArtifactSanitization(state: ProcessingState, text: string) {
  const withoutContinuationGreeting = stripContinuationGreeting(state, text);
  const withoutContextArtifacts = removeContextArtifactPhrases(withoutContinuationGreeting);
  return withoutContextArtifacts.trim() || `${text || ""}`.trim();
}

function applyHardBannedLexemeFilter(text: string): HardBanResult {
  let output = `${text || ""}`.trim();
  if (!output) return { text: "", replacedCount: 0 };

  const bannedRules: ReadonlyArray<[RegExp, string]> = [
    [/\bcontexto\b/gi, "cenario"],
  ];

  let replacedCount = 0;
  for (const [pattern, replacement] of bannedRules) {
    output = output.replace(pattern, (matched) => {
      replacedCount += 1;
      if (matched === matched.toUpperCase()) return replacement.toUpperCase();
      if (matched[0] === matched[0].toUpperCase()) {
        return `${replacement[0].toUpperCase()}${replacement.slice(1)}`;
      }
      return replacement;
    });
  }

  output = output
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  return { text: output, replacedCount };
}

function buildLanguageFallback(target: SupportedOutputLanguage) {
  if (target === "en-US") {
    return "I will continue in English and answer directly.";
  }
  if (target === "es-ES") {
    return "Continuaré en español y responderé de forma directa.";
  }
  return "Vou seguir em português e responder de forma direta.";
}

function resolvePresentationLanguagePolicy(state: ProcessingState) {
  const detected = resolveKnownLanguageTag(state.language);
  const userMessage = `${state.normalizedMessage || state.rawMessage || ""}`;
  const requestedDirective = detectRequestedLanguageDirective(userMessage);
  let target: SupportedOutputLanguage = detected !== "unknown" ? detected : "pt-BR";
  let reason = detected !== "unknown" ? "detected_language" : "default_pt_br";

  if (requestedDirective?.language && requestedDirective.language !== "unknown") {
    if (detected === "unknown") {
      target = requestedDirective.language;
      reason = "requested_language_without_detection";
    } else if (requestedDirective.explicitDirective) {
      target = requestedDirective.language;
      reason = "explicit_user_language_override";
    } else {
      reason = "detected_language_prioritized";
    }
  }

  if (!requestedDirective?.explicitDirective && isLikelyPortugueseInput(userMessage)) {
    target = "pt-BR";
    reason = "pt_surface_override";
  }

  return {
    detected,
    requested: requestedDirective?.language || null,
    target,
    reason,
  };
}

function enforcePresentationLanguage(state: ProcessingState, text: string): PresentationLanguageGuardResult {
  const source = `${text || ""}`.trim();
  const policy = resolvePresentationLanguagePolicy(state);
  const surface = detectSurfaceLanguage(source);
  const mismatch =
    source.length > 0 &&
    surface !== "unknown" &&
    policy.target !== surface;
  const knownEnglishLeakInPt = policy.target === "pt-BR" && hasKnownEnglishLeak(source);
  const explicitDirectiveOverrideMismatch =
    policy.reason === "explicit_user_language_override" &&
    source.length > 0 &&
    policy.target !== surface;
  if (!mismatch && !knownEnglishLeakInPt && !explicitDirectiveOverrideMismatch) {
    return {
      text: source,
      targetLanguage: policy.target,
      detectedLanguage: policy.detected,
      requestedLanguage: policy.requested,
      surfaceLanguage: surface,
      applied: false,
      reason: policy.reason,
    };
  }

  if (policy.target === "pt-BR") {
    const identityFallback = resolveIdentityNarrativeFallback(state);
    if (identityFallback) {
      return {
        text: identityFallback,
        targetLanguage: policy.target,
        detectedLanguage: policy.detected,
        requestedLanguage: policy.requested,
        surfaceLanguage: surface,
        applied: true,
        reason: `${policy.reason}|pt_identity_fallback`,
      };
    }

    const repaired = repairCommonEnglishLeakToPortuguese(source);
    const repairedSurface = detectSurfaceLanguage(repaired);
    if (repairedSurface === "pt-BR" || !hasKnownEnglishLeak(repaired)) {
      return {
        text: repaired,
        targetLanguage: policy.target,
        detectedLanguage: policy.detected,
        requestedLanguage: policy.requested,
        surfaceLanguage: repairedSurface,
        applied: true,
        reason: `${policy.reason}|pt_surface_repair`,
      };
    }
  }

  return {
    text: buildLanguageFallback(policy.target),
    targetLanguage: policy.target,
    detectedLanguage: policy.detected,
    requestedLanguage: policy.requested,
    surfaceLanguage: surface,
    applied: true,
    reason: `${policy.reason}|language_fallback`,
  };
}

function runPresentationWatchdog(
  state: ProcessingState,
  text: string,
  targetLanguage: SupportedOutputLanguage,
): PresentationWatchdogResult {
  let output = `${text || ""}`.trim();
  if (!output) {
    return {
      text: "",
      triggered: false,
      issues: [],
      surfaceBefore: "unknown",
      surfaceAfter: "unknown",
      promptEchoDetected: false,
      mixedLanguageDetected: false,
    };
  }

  const prompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const issues: string[] = [];
  const surfaceBefore = detectSurfaceLanguage(output);
  const promptEchoDetected = isPromptEcho(output, prompt);
  if (promptEchoDetected) {
    const deEchoed = stripPromptEcho(output, prompt);
    if (deEchoed !== output) {
      output = deEchoed;
      issues.push("prompt_echo_removed");
    }
  }

  if (targetLanguage === "pt-BR") {
    const structuralRepaired = applyEnglishStructuralRepairsForPortuguese(output);
    if (structuralRepaired !== output) {
      output = structuralRepaired;
      issues.push("en_structural_repair_applied");
    }

    const lexicalRepaired = repairCommonEnglishLeakToPortuguese(output);
    if (lexicalRepaired !== output) {
      output = lexicalRepaired;
      issues.push("en_lexical_repair_applied");
    }

    const tokenRepaired = applyEnglishTokenRepairsForPortuguese(output);
    if (tokenRepaired !== output) {
      output = tokenRepaired;
      issues.push("en_token_repair_applied");
    }
  }

  const filtered = filterSentencesToTargetLanguage(output, targetLanguage);
  if (filtered !== output) {
    output = filtered;
    issues.push("cross_language_sentences_removed");
  }

  const mixedLanguageDetected = hasStrongMixedLanguageEvidence(output, targetLanguage);
  if (mixedLanguageDetected) {
    if (targetLanguage === "pt-BR") {
      const fallback = filterSentencesToTargetLanguage(
        applyEnglishTokenRepairsForPortuguese(repairCommonEnglishLeakToPortuguese(output)),
        "pt-BR",
      );
      output = fallback || "Vou responder em português de forma direta e sem repetir o enunciado.";
      issues.push("mixed_language_fallback_applied");
    } else if (targetLanguage === "en-US") {
      output = filterSentencesToTargetLanguage(output, "en-US") || "I will answer directly in English.";
      issues.push("mixed_language_fallback_applied");
    } else if (targetLanguage === "es-ES") {
      output = filterSentencesToTargetLanguage(output, "es-ES") || "Responderé de forma directa en español.";
      issues.push("mixed_language_fallback_applied");
    }
  }

  output = output
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  const terminalSurface = detectSurfaceLanguage(output);
  if (targetLanguage === "pt-BR" && terminalSurface === "en-US") {
    output = "Vou responder em português de forma direta e sem repetir o enunciado.";
    issues.push("terminal_pt_guard_fallback");
  }
  if (targetLanguage === "pt-BR" && hasResidualEnglishLeakForPortuguese(output)) {
    output = "Vou responder em português de forma direta e sem repetir o enunciado.";
    issues.push("residual_en_leak_pt_fallback");
  }

  const surfaceAfter = detectSurfaceLanguage(output);
  return {
    text: output,
    triggered: issues.length > 0,
    issues,
    surfaceBefore,
    surfaceAfter,
    promptEchoDetected,
    mixedLanguageDetected,
  };
}

function shouldApplyDialogicProgression(state: ProcessingState, text: string) {
  return (
    Boolean(state.communicativeElaborationState) &&
    text.length >= 80 &&
    state.executionPlan.selectedRoute !== "minimum" &&
    state.selectedMode !== "chat" &&
    !state.conversationState.needsClarification
  );
}

function shouldApplyEpistemicClarity(state: ProcessingState) {
  return state.epistemicAuditState.claimCount > 0 && state.executionPlan.selectedRoute !== "minimum";
}

function shouldApplyPhilosophicalConsistency(state: ProcessingState) {
  return Boolean(state.philosophicalSelfModelState) && !state.philosophicalSelfModelState?.consistencyOk;
}

function shouldForceConciseAnswer(state: ProcessingState) {
  return /\b(curta e grossa|curto e grosso|resposta curta|apenas responda|s[oó] diga|sem explicar|sem analisar|direto ao ponto)\b/i.test(
    `${state.normalizedMessage || state.rawMessage || ""}`,
  );
}

function normalizeTemporalQuery(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCurrentDateQuestion(value: string) {
  const normalized = normalizeTemporalQuery(value);
  if (!normalized) return false;

  const asksDate =
    /\b(que dia e hoje|qual o dia de hoje|qual dia e hoje|qual e a data de hoje|data de hoje|dia de hoje)\b/.test(normalized) ||
    (/\b(hoje)\b/.test(normalized) && /\b(que dia|qual dia|data)\b/.test(normalized));
  const asksTimeOnly = /\b(que horas sao|hora agora|horas agora|que horas e agora)\b/.test(normalized);
  return asksDate && !asksTimeOnly;
}

function capitalizeFirst(value: string) {
  if (!value) return value;
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function buildCurrentDateAnswer(timeZone = "America/Sao_Paulo") {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone }).format(now);
  const fullDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(now);
  return `Hoje é ${capitalizeFirst(weekday)}, ${fullDate}.`;
}

function buildAbntAccessDate(timeZone = "America/Sao_Paulo") {
  const now = new Date();
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone }).format(now);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone }).format(now).replace(".", "");
  const year = new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone }).format(now);
  return `${day} ${month}. ${year}`;
}

function normalizeParagraph(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isBoilerplateLeadParagraph(paragraph: string) {
  const normalized = normalizeParagraph(paragraph);
  if (!normalized) return true;
  return /^(considerando a pergunta|considerando a solicitacao|com base na pergunta|leitura inicial:|em resumo,|em conclusao,)/i.test(
    normalized,
  );
}

function normalizeEpistemicSignal(signal: string) {
  return `${signal || ""}`
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
}

function humanizeEpistemicSignal(signal: string) {
  const normalized = normalizeEpistemicSignal(signal);
  if (!normalized) return "";
  if (normalized === "incerteza_alta_por_risco_de_extrapolacao") {
    return "há risco alto de extrapolação, então mantenho cautela nas conclusões.";
  }
  if (normalized === "incerteza_moderada_requer_cautela") {
    return "há incerteza moderada e a conclusão deve ser lida com cautela.";
  }
  if (normalized === "incerteza_controlada") {
    return "";
  }
  if (normalized === "cobertura_evidencial_parcial") {
    return "a cobertura de evidências está parcial.";
  }
  if (normalized.startsWith("flags=")) {
    const flags = normalized.slice(6).trim();
    if (!flags) return "";
    return `existem limites de extrapolação: ${flags.replace(/_/g, " ")}.`;
  }
  return normalized.replace(/_/g, " ");
}

function buildEpistemicClarityNote(state: ProcessingState, baseText: string) {
  if (!shouldApplyEpistemicClarity(state)) return "";
  if (baseText.trim().length < 90) return "";

  const overclaimRisk = state.epistemicAuditState.overclaimRisk || 0;
  const hasVerificationDemand =
    Boolean(state.textAnalysisSnapshot?.hasVerifiableSignal) ||
    Boolean(state.textAnalysisSnapshot?.hasRecencySignal) ||
    Boolean(state.preRouteSignals?.hasVerifiableSignal) ||
    Boolean(state.preRouteSignals?.hasRecencySignal);
  if (!hasVerificationDemand && overclaimRisk < 0.75) return "";

  const rawSignals = state.epistemicAuditState.uncertaintySignals.slice(0, 3);
  const notes = rawSignals.map(humanizeEpistemicSignal).filter(Boolean);
  const hasStrongSignal =
    overclaimRisk >= 0.5 ||
    rawSignals.some((signal) =>
      /incerteza_alta|incerteza_moderada|cobertura_evidencial_parcial|flags=/i.test(signal),
    );

  if (!hasStrongSignal || notes.length === 0) return "";
  return `Nota de cautela: ${notes.join(" ")}`;
}

function isPureEpistemicMarker(text: string) {
  const normalized = normalizeParagraph(text);
  if (!normalized) return true;
  return /^sinal epistemico:\s*/i.test(normalized) || /^consistencia filosofica:\s*/i.test(normalized);
}

function removeEchoAndBoilerplate(text: string) {
  const paragraphs = `${text || ""}`
    .split(/\n{2,}/g)
    .map((row) => row.trim())
    .filter(Boolean);

  while (paragraphs.length > 1 && isBoilerplateLeadParagraph(paragraphs[0])) {
    paragraphs.shift();
  }

  const deduped: string[] = [];
  for (const paragraph of paragraphs) {
    const normalized = normalizeParagraph(paragraph);
    const previous = deduped.length ? normalizeParagraph(deduped[deduped.length - 1]) : "";
    if (normalized && normalized === previous) continue;
    deduped.push(paragraph);
  }

  return deduped.join("\n\n").trim();
}

function applyPresentationPolish(state: ProcessingState, text: string) {
  let output = `${text || ""}`.trim();
  if (!output) return "";
  output = stripPromptEcho(output, `${state.normalizedMessage || state.rawMessage || ""}`);
  output = stripRoleTranscriptTail(output, `${state.normalizedMessage || state.rawMessage || ""}`);

  if (shouldApplyDialogicProgression(state, output)) {
    const opening = state.communicativeElaborationState?.coConstructionPlan.openingMove || "";
    if (opening && !output.toLowerCase().includes("leitura inicial")) {
      output = `${opening}\n\n${output}`;
    }
  }

  if (shouldApplyPhilosophicalConsistency(state)) {
    const notes = state.philosophicalSelfModelState?.consistencyNotes.slice(0, 2).join("; ") || "";
    if (notes && !output.toLowerCase().includes("consistencia filosofica")) {
      output = `${output}\n\nConsistencia filosofica: ${notes}.`;
    }
  }

  let cleaned = removeEchoAndBoilerplate(output);
  if ((!cleaned || /^fontes:/i.test(cleaned)) && !isPureEpistemicMarker(output)) {
    cleaned = output;
  }
  cleaned = cleaned.replace(/^resposta:\s*/i, "").trim();

  const epistemicNote = buildEpistemicClarityNote(state, cleaned);
  if (
    epistemicNote &&
    cleaned &&
    !/^nota de cautela:/i.test(normalizeParagraph(cleaned)) &&
    !cleaned.toLowerCase().includes("nota de cautela:")
  ) {
    cleaned = `${cleaned}\n\n${epistemicNote}`;
  }

  if (shouldForceConciseAnswer(state)) {
    const withoutSources = cleaned.replace(/\n{1,}fontes:\s*[\s\S]*$/i, "").trim();
    const sentences = withoutSources.split(/(?<=[.!?])\s+/g).filter(Boolean);
    const concise = (sentences.length > 3 ? sentences.slice(0, 3).join(" ") : withoutSources).trim();
    if (concise) {
      const surface = applyPortugueseSurfaceRepairs(concise);
      return applyBackendArtifactSanitization(state, surface);
    }
  }

  const surface = applyPortugueseSurfaceRepairs(cleaned);
  return applyBackendArtifactSanitization(state, surface);
}

export async function runPresentationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const promptText = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const responseForDelivery = `${state.finalResponse || state.structuredResponse || state.humanizedResponse || ""}`.trim();
  const utf8Guard = ensureUtf8Response(responseForDelivery);
  const channel = resolveDeliveryChannel();
  const citationRequestContext = resolveCitationRequestContext(state);
  const httpRetrievedSources = state.retrievedSources.filter((source) => isHttpUrl(source.url));
  const code = codeBlockAdapter({ text: utf8Guard.text });
  const preLayoutText = applyPresentationPolish(state, code.cleanedText || utf8Guard.text);
  const hasEnumerativeSignals =
    /(^|\n)\s*(?:[-*•]|\d+\.)\s+/.test(preLayoutText) ||
    /\b(a\)|b\)|c\)|d\)|e\)|f\)|g\))\b/i.test(preLayoutText);
  const responseLayoutPlan = buildResponseLayoutPlan({
    text: preLayoutText,
    prompt: promptText,
    hasCodeBlocks: code.codeBlocks.length > 0,
    hasCitations: httpRetrievedSources.length > 0,
    hasMedia: state.retrievedSources.length > 0,
    hasEnumerativeSignals,
    requestedList: /\b(lista|liste|listar|em topicos|bullet|itens)\b/i.test(promptText),
    requestedHeading: /\b(titulo|titulos|secoes|secao|subtitulo|subtitulos)\b/i.test(promptText),
  });
  const layoutDrivenText = applyHeadingAndListStrategy(preLayoutText, responseLayoutPlan);
  const preSerializeAudit = textualOutputAuditor(layoutDrivenText, responseLayoutPlan);
  const compositionText = `${preSerializeAudit.repairedText || layoutDrivenText}`.trim() || preLayoutText;
  const bubble = chatBubbleAdapter({
    text: compositionText,
    layoutPlan: responseLayoutPlan,
  });

  const accessDate = citationRequestContext.referenceListStyle === "abnt" ? buildAbntAccessDate() : "";
  const citations = citationAdapter({
    sources: httpRetrievedSources,
    requestContext: citationRequestContext,
    accessDate,
  });
  const documents = documentBlockAdapter({
    sources: state.retrievedSources,
    requestContext: citationRequestContext,
    accessDate,
  });
  const media = mediaAdapter({
    text: utf8Guard.text,
    sourceUrls: state.retrievedSources.map((source) => source.url),
  });
  const confidence = confidenceAdapter({
    scores: state.confidenceScores,
    validationReport: state.validationReport,
  });

  const format = resolveDeliveryFormat(channel, code.codeBlocks.length > 0);

  const renderModel: PresentationRenderModel = {
    channel,
    format,
    text: bubble.bubble.text,
    bubble: bubble.bubble,
    citations: citations.citations,
    referenceList: citations.referenceList,
    referenceEntries: citations.referenceEntries,
    citationRequestContext,
    codeBlocks: code.codeBlocks,
    documents: documents.documents,
    media: media.media,
    confidence: confidence.confidence,
    responseLayoutPlan,
    textualAudit: preSerializeAudit,
  };

  const serializedMap: Record<DeliveryFormat, SerializedPresentation> = {
    "plain-text": plainTextSerializer({ model: renderModel }),
    markdown: markdownSerializer({ model: renderModel }),
    "json-block": jsonBlockSerializer({ model: renderModel }),
    "rich-text": richTextSerializer({ model: renderModel }),
  };

  const selectedSerialized = selectSerialized(format, serializedMap);
  const stream = buildPresentationStream({
    text: selectedSerialized.text,
    channel,
    layoutPlan: responseLayoutPlan,
  });

  const front = buildPresentationFrontDelivery({
    channel,
    serialized: selectedSerialized,
    citations: citations.citations.filter((row) => isHttpUrl(row.url)).map((row) => row.url),
    stream: stream.serialized,
  });

  const finalCitations = citations.citations.filter((row) => isHttpUrl(row.url)).map((row) => row.url);
  const rawFinalText = `${front.delivery.text || selectedSerialized.text || bubble.bubble.text}`.trim();
  const forcedDateAnswer = isCurrentDateQuestion(state.normalizedMessage || state.rawMessage)
    ? buildCurrentDateAnswer()
    : null;
  const polishedText = forcedDateAnswer || applyPresentationPolish(state, rawFinalText);
  const postLayoutText = forcedDateAnswer
    ? polishedText
    : applyHeadingAndListStrategy(polishedText, responseLayoutPlan);
  const finalTextualAudit = forcedDateAnswer
    ? { passed: true, score: 1, issues: [] as string[] }
    : textualOutputAuditor(postLayoutText, responseLayoutPlan);
  const auditedText = `${finalTextualAudit.repairedText || postLayoutText}`.trim() || polishedText;
  const languageGuard = enforcePresentationLanguage(state, auditedText);
  const finalTextGuard = ensureUtf8Response(languageGuard.text);
  const hardBanResult = applyHardBannedLexemeFilter(finalTextGuard.text);
  const watchdogResult = runPresentationWatchdog(state, hardBanResult.text, languageGuard.targetLanguage);
  const watchdogTextGuard = ensureUtf8Response(watchdogResult.text);
  const finalText = watchdogTextGuard.text;

  state.structuredResponse = finalText;
  state.deliveryPayload = {
    channel: front.delivery.channel,
    format: front.delivery.format,
    text: finalText,
    citations: finalCitations,
  };

  state.executionArtifacts = {
    ...state.executionArtifacts,
    presentation: {
      channel: front.delivery.channel,
      format: front.delivery.format,
      selectedSerializer: selectedSerialized.format,
      adapters: [
        bubble.component,
        code.component,
        citations.component,
        documents.component,
        media.component,
        confidence.component,
      ],
      serializers: ["plain-text", "markdown", "json-block", "rich-text"],
      streamControllers: [
        "token-stream-manager",
        "sentence-buffering",
        "paragraph-flush-logic",
        "progressive-reveal-manager",
        "stream-recovery-manager",
      ],
      streamChunkCount: stream.serialized.chunkCount,
      streamRecovered: stream.recovered,
      retryPolicy: front.retryPolicy,
      utf8Repaired: utf8Guard.repaired || finalTextGuard.repaired || watchdogTextGuard.repaired,
      dialogicProgressionApplied: shouldApplyDialogicProgression(state, rawFinalText),
      epistemicClarityApplied: shouldApplyEpistemicClarity(state),
      philosophicalConsistencyApplied: shouldApplyPhilosophicalConsistency(state),
      languageTarget: languageGuard.targetLanguage,
      languageDetected: languageGuard.detectedLanguage,
      languageRequested: languageGuard.requestedLanguage,
      languageSurfaceDetected: languageGuard.surfaceLanguage,
      languagePolicyApplied: languageGuard.applied,
      languagePolicyReason: languageGuard.reason,
      responseLayoutShape: responseLayoutPlan.rhetoricalShape,
      responseLayoutComplexity: responseLayoutPlan.complexity,
      responseLayoutNotes: responseLayoutPlan.notes,
      textualAuditScore: finalTextualAudit.score,
      textualAuditIssues: finalTextualAudit.issues,
      citationStyle: citationRequestContext.citationStyle,
      referenceListStyle: citationRequestContext.referenceListStyle,
      presentationWatchdogTriggered: watchdogResult.triggered,
      presentationWatchdogIssues: watchdogResult.issues,
      presentationWatchdogSurfaceBefore: watchdogResult.surfaceBefore,
      presentationWatchdogSurfaceAfter: watchdogResult.surfaceAfter,
      presentationWatchdogPromptEchoDetected: watchdogResult.promptEchoDetected,
      presentationWatchdogMixedLanguageDetected: watchdogResult.mixedLanguageDetected,
    },
  };

  state.trace.push(
    makeTraceEvent({
      layer: "presentation",
      action: "delivery_payload_ready",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `channel=${front.delivery.channel}; format=${front.delivery.format}; serializer=${selectedSerialized.format}; ` +
        `utf8_repaired=${utf8Guard.repaired || finalTextGuard.repaired}; citations=${finalCitations.length}; stream_chunks=${stream.serialized.chunkCount}; recovered=${stream.recovered}; ` +
        `date_guard_applied=${forcedDateAnswer ? "true" : "false"}; language_target=${languageGuard.targetLanguage}; ` +
        `language_surface=${languageGuard.surfaceLanguage}; language_policy_applied=${languageGuard.applied ? "true" : "false"}; ` +
        `language_policy_reason=${languageGuard.reason}; hard_ban_contexto_replacements=${hardBanResult.replacedCount}; ` +
        `presentation_watchdog_triggered=${watchdogResult.triggered ? "true" : "false"}; presentation_watchdog_issues=${watchdogResult.issues.length}; ` +
        `presentation_watchdog_surface_before=${watchdogResult.surfaceBefore}; presentation_watchdog_surface_after=${watchdogResult.surfaceAfter}; ` +
        `layout_shape=${responseLayoutPlan.rhetoricalShape}; layout_complexity=${responseLayoutPlan.complexity}; textual_audit_score=${finalTextualAudit.score.toFixed(2)}; ` +
        `citation_style=${citationRequestContext.citationStyle}; references_style=${citationRequestContext.referenceListStyle}`,
    }),
  );

  return state;
}
