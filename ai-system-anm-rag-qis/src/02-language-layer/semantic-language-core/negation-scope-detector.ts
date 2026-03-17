/**
 * Responsabilidade do arquivo:
 * - Mapear alcance local da negacao em janelas curtas de tokens.
 * - Fornecer spans aproximados para evitar leitura semantica invertida.
 * - Operar apenas em superficie, sem parse sintatico profundo.
 */
import { tokenizeWords } from "../utils/token-utils";

export interface NegationScopeDetectorInput {
  text: string;
}

export interface NegationScopeDetectorResult {
  negationSpans: string[];
}

const NEGATION_WORDS = new Set(["nao", "nunca", "jamais", "nem", "not", "never", "no"]);

export function negationScopeDetector(input: NegationScopeDetectorInput): NegationScopeDetectorResult {
  const tokens = tokenizeWords(`${input.text || ""}`.toLowerCase());
  const spans: string[] = [];

  tokens.forEach((token, index) => {
    if (!NEGATION_WORDS.has(token)) return;
    spans.push(tokens.slice(index, index + 4).join(" "));
  });

  return { negationSpans: spans.slice(0, 12) };
}

