/**
 * KnexPdfStyle.ts
 *
 * Compatibilidade mínima para o PdfNativeTextExtractor.
 *
 * Este arquivo NÃO deve decidir estilo visual neste momento.
 * Ele existe apenas para transformar KnexPdfStyle.ts em módulo TypeScript válido
 * e satisfazer o import:
 *
 * import { normalizeKnexPdfTextStyle } from "../../core/KnexPdfStyle";
 *
 * Importante:
 * - não remapeia fonte;
 * - não força fallback;
 * - não arredonda;
 * - não recalcula lineHeight;
 * - não altera serif/sans-serif;
 * - apenas devolve os mesmos campos recebidos.
 */

export type KnexPdfTextStyleInput = {
  text?: string | null;
  fontFamily?: string | null;
  fontName?: string | null;
  fontSize?: number | null;
  fontWeight?: string | number | null;
  fontStyle?: string | null;
  color?: string | null;
  opacity?: number | null;
  lineHeight?: number | null;
  letterSpacing?: number | null;
  wordSpacing?: number | null;
  source?: string | null;
};

export function normalizeKnexPdfTextStyle(input: KnexPdfTextStyleInput): any {
  return input;
}
