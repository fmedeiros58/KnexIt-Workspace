import type { LeticiaIntent } from "../types";
import { compactWhitespace, detectLocaleFromText, normalizeForIntentMatch } from "../utils/text";

const GREETING_PATTERNS = [
  /^(oi|ola|opa|saudacoes|e ai|eae|hey|hello|hi)\b/,
  /^(bom dia|boa tarde|boa noite)\b/,
  /^(hola|buenos dias|buenas tardes|buenas noches)\b/,
];
const GRATITUDE_PATTERNS = [/^(obrigado|obrigada|obg|valeu|gracias|thanks|thank you)$/];
const FAREWELL_PATTERNS = [/^(tchau|ate logo|ate mais|falou|bye|goodbye|hasta luego)$/];
const CONFIRMATION_PATTERNS = [/^(sim|isso|ok|okay|certo|perfeito|yes|yep|si)$/];
const NEGATION_PATTERNS = [/^(nao|não|negativo|nope|no)$/];
const HELP_PATTERNS = [/\b(me ajuda|preciso de ajuda|can you help|ayudame|ajuda)\b/];
const QUESTION_PATTERNS = [/[?]$/, /\b(como|qual|quais|quando|onde|por que|porque|quem|what|when|where|why|who|how)\b/];
const COMMAND_PATTERNS = [/^(abra|mostre|liste|gere|crie|fa[çc]a|execute|run|open|show)\b/];

function matchesAny(patterns: RegExp[], value: string) {
  return patterns.some((pattern) => pattern.test(value));
}

export function classifyLeticiaIntent(input: string): LeticiaIntent {
  const normalizedText = compactWhitespace(input);
  const folded = normalizeForIntentMatch(normalizedText);
  const locale = detectLocaleFromText(normalizedText);
  const words = folded.split(" ").filter(Boolean);
  const isMicroTurn = normalizedText.length <= 64 && words.length <= 10;

  if (!folded) {
    return {
      name: "ambiguous",
      locale,
      normalizedText: folded,
      confidence: 0.2,
      expectsDirectReply: false,
      isMicroTurn: true,
    };
  }

  if (matchesAny(GREETING_PATTERNS, folded) && words.length <= 6) {
    return { name: "greeting", locale, normalizedText: folded, confidence: 0.98, expectsDirectReply: true, isMicroTurn: true };
  }
  if (matchesAny(GRATITUDE_PATTERNS, folded)) {
    return { name: "gratitude", locale, normalizedText: folded, confidence: 0.98, expectsDirectReply: true, isMicroTurn: true };
  }
  if (matchesAny(FAREWELL_PATTERNS, folded)) {
    return { name: "farewell", locale, normalizedText: folded, confidence: 0.97, expectsDirectReply: true, isMicroTurn: true };
  }
  if (matchesAny(CONFIRMATION_PATTERNS, folded)) {
    return { name: "confirmation", locale, normalizedText: folded, confidence: 0.9, expectsDirectReply: true, isMicroTurn };
  }
  if (matchesAny(NEGATION_PATTERNS, folded)) {
    return { name: "negation", locale, normalizedText: folded, confidence: 0.9, expectsDirectReply: true, isMicroTurn };
  }
  if (matchesAny(HELP_PATTERNS, folded)) {
    return { name: "help_request", locale, normalizedText: folded, confidence: 0.88, expectsDirectReply: true, isMicroTurn };
  }
  if (matchesAny(COMMAND_PATTERNS, folded)) {
    return { name: "command", locale, normalizedText: folded, confidence: 0.8, expectsDirectReply: true, isMicroTurn };
  }
  if (matchesAny(QUESTION_PATTERNS, normalizedText) || matchesAny(QUESTION_PATTERNS, folded)) {
    return { name: "question", locale, normalizedText: folded, confidence: 0.8, expectsDirectReply: true, isMicroTurn };
  }

  return {
    name: "statement",
    locale,
    normalizedText: folded,
    confidence: isMicroTurn ? 0.62 : 0.74,
    expectsDirectReply: false,
    isMicroTurn,
  };
}
