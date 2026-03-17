import { normalizeWhitespace } from "../../shared/utils/text-utils";

export function extractTextViaOcrFallback(raw: string): string {
  // OCR fallback simplificado para manter conducao estavel quando parser falha.
  return normalizeWhitespace(raw.replace(/[^\p{L}\p{N}\s.,;:!?-]/gu, " "));
}
