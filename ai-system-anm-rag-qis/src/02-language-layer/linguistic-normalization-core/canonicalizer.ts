/**
 * Responsabilidade do arquivo:
 * - Gerar forma canonica de superficie para comparacoes internas da camada.
 * - Padronizar texto em lowercase e espaco simples para matching consistente.
 * - Nao substituir o texto de exibicao ao usuario.
 */
import { normalizeForComparison } from "../utils/accent-utils";
import { compactWhitespace } from "../utils/normalization-utils";

export interface CanonicalizerInput {
  text: string;
}

export interface CanonicalizerResult {
  canonicalText: string;
}

export function canonicalizer(input: CanonicalizerInput): CanonicalizerResult {
  return {
    canonicalText: compactWhitespace(normalizeForComparison(input.text)),
  };
}

