/**
 * Responsabilidade do arquivo:
 * - Construir snapshot textual unico e reutilizavel para o pipeline.
 * - Evitar recalculos redundantes de tokenizacao/estatisticas por camada.
 * - Expor sinais sintaticos e semanticos de baixo custo para roteamento e gates.
 */
export interface TextAnalysisSnapshot {
  sourceText: string;
  normalizedText: string;
  lowerText: string;
  tokens: string[];
  sentences: string[];
  tokenCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  uniqueTokenRatio: number;
  longTokenCount: number;
  longTokenRatio: number;
  punctuationCount: number;
  questionCount: number;
  exclamationCount: number;
  connectiveCount: number;
  pronounCount: number;
  ambiguousTermCount: number;
  modalCount: number;
  negationCount: number;
  imperativeHintCount: number;
  greetingCount: number;
  recencySignalCount: number;
  verifiableSignalCount: number;
  hasRecencySignal: boolean;
  hasVerifiableSignal: boolean;
  hasGreetingSignal: boolean;
}

const CONNECTIVE_PATTERN =
  /\b(porque|portanto|contudo|entretanto|logo|porem|however|therefore|since|although|if|then|se|entao)\b/gi;

const PRONOUN_PATTERN =
  /\b(isso|isto|aquilo|esse|essa|este|esta|that|this|it|those|these)\b/gi;

const AMBIGUOUS_PATTERN =
  /\b(ou|or|talvez|maybe|depende|it depends|pode ser|possibly|aprox|around|algum|some|coisa|something)\b/gi;

const MODAL_PATTERN =
  /\b(pode|poderia|deve|deveria|talvez|may|might|must|should|can|could)\b/gi;

const NEGATION_PATTERN =
  /\b(nao|never|not|jamais|nunca|sem)\b/gi;

const IMPERATIVE_HINT_PATTERN =
  /\b(faca|crie|gere|liste|explique|resuma|mostre|ajuste|corrija|implemente|build|create|generate|list|explain|summarize|show|fix|adjust|implement)\b/gi;

const GREETING_PATTERN =
  /\b(oi+|oie+|ola+|opa+|fala+|salve+|saudacoes|saudacao|bom dia|boa tarde|boa noite|boa madrugada|boa manha|alo|alou|e ai|eae|hello|hi|hey|yo)\b/gi;

const RECENCY_PATTERN =
  /\b(atual|latest|today|hoje|agora|this week|neste mes|recent|recente|recentemente)\b/gi;

const VERIFIABLE_PATTERN =
  /\b(presidente|governador|prefeito|ceo|capital|quando|when|where|fonte|source|cite|qual e)\b/gi;

function countMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) || []).length;
}

function splitTokens(text: string) {
  return text
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function buildTextAnalysisSnapshot(text: string): TextAnalysisSnapshot {
  const normalizedText = normalizeWhitespace(text || "");
  const lowerText = normalizedText.toLowerCase();
  const tokens = splitTokens(normalizedText);
  const sentences = splitSentences(normalizedText);

  const tokenCount = tokens.length;
  const sentenceCount = sentences.length || (normalizedText ? 1 : 0);
  const avgSentenceLength = sentenceCount > 0 ? tokenCount / sentenceCount : 0;

  const uniqueTokenRatio =
    tokenCount > 0 ? new Set(tokens.map((token) => token.toLowerCase())).size / tokenCount : 0;

  const longTokenCount = tokens.filter((token) => token.length >= 8).length;
  const longTokenRatio = tokenCount > 0 ? longTokenCount / tokenCount : 0;

  const punctuationCount = (normalizedText.match(/[;:(),]/g) || []).length;
  const questionCount = (normalizedText.match(/\?/g) || []).length;
  const exclamationCount = (normalizedText.match(/!/g) || []).length;

  const connectiveCount = countMatches(lowerText, CONNECTIVE_PATTERN);
  const pronounCount = countMatches(lowerText, PRONOUN_PATTERN);
  const ambiguousTermCount = countMatches(lowerText, AMBIGUOUS_PATTERN);
  const modalCount = countMatches(lowerText, MODAL_PATTERN);
  const negationCount = countMatches(lowerText, NEGATION_PATTERN);
  const imperativeHintCount = countMatches(lowerText, IMPERATIVE_HINT_PATTERN);
  const greetingCount = countMatches(lowerText, GREETING_PATTERN);
  const recencySignalCount = countMatches(lowerText, RECENCY_PATTERN);
  const verifiableSignalCount = countMatches(lowerText, VERIFIABLE_PATTERN);

  return {
    sourceText: text || "",
    normalizedText,
    lowerText,
    tokens,
    sentences,
    tokenCount,
    sentenceCount,
    avgSentenceLength,
    uniqueTokenRatio,
    longTokenCount,
    longTokenRatio,
    punctuationCount,
    questionCount,
    exclamationCount,
    connectiveCount,
    pronounCount,
    ambiguousTermCount,
    modalCount,
    negationCount,
    imperativeHintCount,
    greetingCount,
    recencySignalCount,
    verifiableSignalCount,
    hasRecencySignal: recencySignalCount > 0,
    hasVerifiableSignal: verifiableSignalCount > 0,
    hasGreetingSignal: greetingCount > 0,
  };
}

