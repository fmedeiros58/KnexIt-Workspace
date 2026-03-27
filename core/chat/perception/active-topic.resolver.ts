import type { ConversationChatHistoryItem } from "./types";

const TOPIC_STOPWORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "para",
  "por",
  "com",
  "sem",
  "na",
  "no",
  "nas",
  "nos",
  "um",
  "uma",
  "uns",
  "umas",
  "que",
  "como",
  "qual",
  "quais",
  "isso",
  "isto",
  "esse",
  "essa",
  "dessa",
  "desse",
  "sobre",
  "agora",
  "aqui",
  "vc",
  "voce",
  "voces",
  "chat",
  "resposta",
  "respostas",
  "texto",
  "ajuste",
  "ajustar",
  "continue",
  "continuar",
]);

const CONTINUATION_PATTERNS = [
  /\b(continue|continuar|continua|continuacao|seguindo|prossiga)\b/i,
  /\b(ajuste|ajustar|refine|refinar|melhore|melhorar)\b/i,
  /\b(esse|essa|isso|isto)\s+(texto|tema|topico|assunto)\b/i,
  /\b(com\s+base\s+no|sobre\s+isso|acima)\b/i,
];

const EXPLICIT_TOPIC_SWITCH_PATTERNS = [
  /\b(mudar\s+de\s+assunto|mudando\s+de\s+assunto)\b/i,
  /\b(novo\s+assunto|outro\s+assunto|outro\s+tema)\b/i,
  /\b(agora\s+sobre|vamos\s+falar\s+de)\b/i,
];

const MICRO_SOCIAL_PATTERNS = [
  /^(oi|ola|ol[aá]|oie|oii|e ai|eae|opa|saudacoes|hey|hello|hi)$/i,
  /^(bom dia|boa tarde|boa noite)$/i,
  /^(blz|beleza|tudo bem|td bem|como vai|como vc esta|como voce esta|how are you|que tal)$/i,
  /^(oi|ola|opa|saudacoes)\s+(tudo bem|td bem|como vai|que tal)$/i,
  /^(obrigado|obg|valeu|thanks|thank you|gracias)$/i,
  /^(tchau|falou|ate mais|at[eé] mais|ate logo|at[eé] logo|bye|adios)$/i,
];

function normalizeTokenSource(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(text: string, limit = 4) {
  const normalized = normalizeTokenSource(text);
  if (!normalized) return [];
  const counts = new Map<string, number>();
  for (const token of normalized.split(" ")) {
    if (!token || token.length < 3 || TOPIC_STOPWORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function normalizeTopicLabel(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= 96) return compact;
  return `${compact.slice(0, 93).trimEnd()}...`;
}

function isMicroSocialPrompt(prompt: string) {
  const compact = prompt
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return false;
  const words = compact.split(" ").filter(Boolean);
  if (words.length > 8 || compact.length > 64) return false;
  return MICRO_SOCIAL_PATTERNS.some((pattern) => pattern.test(compact));
}

function buildTopicFromKeywords(text: string) {
  const keywords = extractKeywords(text, 4);
  if (!keywords.length) return "";
  return normalizeTopicLabel(keywords.join(" / "));
}

function readRecentUserMessages(history: ConversationChatHistoryItem[], limit = 4) {
  return history
    .filter((item) => item.role === "user")
    .slice(-limit)
    .map((item) => item.content);
}

export function detectContinuityMode(prompt: string, previousTopic: string): "continue" | "adjust" | "replace" {
  const normalized = prompt.trim();
  if (!normalized) return previousTopic ? "continue" : "replace";
  if (isMicroSocialPrompt(normalized)) return "replace";
  if (EXPLICIT_TOPIC_SWITCH_PATTERNS.some((pattern) => pattern.test(normalized))) return "replace";
  if (CONTINUATION_PATTERNS.some((pattern) => pattern.test(normalized))) return "adjust";
  if (!previousTopic) return "replace";
  return "continue";
}

export function resolveActiveTopic(input: {
  prompt: string;
  history: ConversationChatHistoryItem[];
  previousTopic: string;
}) {
  const { prompt, history, previousTopic } = input;
  const mode = detectContinuityMode(prompt, previousTopic);
  if (mode !== "replace" && previousTopic) return normalizeTopicLabel(previousTopic);

  const fromPrompt = buildTopicFromKeywords(prompt);
  if (fromPrompt) return fromPrompt;

  const recentUserMessages = readRecentUserMessages(history, 4).join(" ");
  const fromHistory = buildTopicFromKeywords(recentUserMessages);
  if (fromHistory) return fromHistory;

  return normalizeTopicLabel(previousTopic || "conversa em andamento");
}

export function resolveActiveSubtopic(input: {
  prompt: string;
  previousSubtopic: string;
  continuityMode: "continue" | "adjust" | "replace";
}) {
  const { prompt, previousSubtopic, continuityMode } = input;
  const fromPrompt = buildTopicFromKeywords(prompt);
  if (fromPrompt) return fromPrompt;
  if (continuityMode !== "replace" && previousSubtopic) return normalizeTopicLabel(previousSubtopic);
  return "";
}


