import type { ProcessingState } from "../../bridges/contracts/processing-state";

const MAX_SOURCE_ITEMS = 8;
const MAX_CONTEXT_ITEMS = 3;
const MAX_ITEM_CHARS = 220;

export function buildContextInjection(state: ProcessingState): string {
  const safeItems = (state.activeContext ?? [])
    .slice(-MAX_SOURCE_ITEMS)
    .map(sanitizeContextItem)
    .filter((value): value is string => Boolean(value))
    .filter(uniqueNormalized)
    .slice(-MAX_CONTEXT_ITEMS);

  if (safeItems.length === 0) {
    return "Contexto auxiliar: nenhum contexto relevante disponível.";
  }

  return [
    "Contexto auxiliar abaixo. Use apenas como apoio implícito para manter continuidade e precisão.",
    "Não copie trechos literalmente. Não reproduza histórico de conversa. Não escreva rótulos como 'Usuário:', 'Assistente:' ou nomes de persona.",
    "<contexto_auxiliar>",
    ...safeItems.map((item) => `- ${item}`),
    "</contexto_auxiliar>",
  ].join("\n");
}

function sanitizeContextItem(raw: string): string | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  let text = normalizeWhitespace(raw);

  if (!text) {
    return null;
  }

  if (isLikelyTranscript(text)) {
    return null;
  }

  text = stripRoleMarkers(text);
  text = normalizeWhitespace(text);
  text = text.replace(/\s*\|\s*/g, " — ");

  if (!text || isLowValueContext(text)) {
    return null;
  }

  return clampText(text, MAX_ITEM_CHARS);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripRoleMarkers(value: string): string {
  return value
    .replace(
      /\b(?:usuário|usuario|user|assistente|assistant|sistema|system|let[ií]cia)\s*:\s*/gi,
      "",
    )
    .replace(/\b(?:humano|ai|modelo)\s*:\s*/gi, "")
    .trim();
}

function isLikelyTranscript(value: string): boolean {
  const markers =
    value.match(
      /\b(?:usuário|usuario|user|assistente|assistant|sistema|system|let[ií]cia|humano|ai|modelo)\s*:/gi,
    ) ?? [];

  const hasLineBreaks = /[\r\n]/.test(value);
  return markers.length >= 2 || (markers.length >= 1 && hasLineBreaks);
}

function isLowValueContext(value: string): boolean {
  const normalized = value.toLowerCase();

  if (normalized === "(vazio)" || normalized === "vazio") {
    return true;
  }

  return value.length < 8;
}

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars - 1).trimEnd()}…`;
}

function uniqueNormalized(value: string, index: number, array: string[]): boolean {
  const current = value.toLowerCase();
  return array.findIndex((item) => item.toLowerCase() === current) === index;
}