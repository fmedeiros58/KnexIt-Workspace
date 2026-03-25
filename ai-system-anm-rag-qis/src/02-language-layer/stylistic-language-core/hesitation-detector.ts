/**
 * Responsabilidade do arquivo:
 * - Detectar marcas explicitas de hesitacao/indecisao.
 * - Produzir score para calibrar necessidade de clarificacao.
 * - Isolar esse sinal do detector geral de confianca.
 */
import { clamp01 } from "../utils/normalization-utils";

export interface HesitationDetectorInput {
  text: string;
}

export interface HesitationDetectorResult {
  hesitationScore: number;
}

export function hesitationDetector(input: HesitationDetectorInput): HesitationDetectorResult {
  const text = `${input.text || ""}`.toLowerCase();
  const hits = (text.match(/\b(talvez|hmm|hum|nao sei|acho que|quem sabe|pode ser)\b/g) || []).length;
  return { hesitationScore: clamp01(hits * 0.2) };
}

