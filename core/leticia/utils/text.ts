import type { LeticiaLocale } from "../types";

export function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeForMatch(value: string) {
  return compactWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function normalizeForIntentMatch(value: string) {
  return normalizeForMatch(value)
    .replace(/[!?.,;:()[\]{}"“”'`´~^/_\\|@#$%&*+=<>-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(value: string, max: number) {
  if (value.length <= max) return value;
  if (max <= 3) return value.slice(0, max);
  return `${value.slice(0, max - 3)}...`;
}

export function escapeSqlIdentifier(value: string) {
  return value.replace(/"/g, "\"\"");
}

export function detectLocaleFromText(value: string): LeticiaLocale {
  const normalized = normalizeForMatch(value);
  if (!normalized) return "pt-BR";

  const englishSignals = [
    /\b(hello|hi|thanks|thank you|please|good morning|good afternoon|good evening|how are you)\b/,
    /\b(what|when|where|why|who|which|can you|could you)\b/,
  ];
  if (englishSignals.some((pattern) => pattern.test(normalized))) return "en-US";

  const spanishSignals = [
    /\b(hola|gracias|por favor|buenos dias|buenas tardes|buenas noches|como estas)\b/,
    /\b(que|cuando|donde|por que|quien|puedes|podrias)\b/,
  ];
  if (spanishSignals.some((pattern) => pattern.test(normalized))) return "es-ES";

  return "pt-BR";
}

export function sanitizeModelFacingText(value: string) {
  return compactWhitespace(value).replace(/\u0000/g, "");
}
