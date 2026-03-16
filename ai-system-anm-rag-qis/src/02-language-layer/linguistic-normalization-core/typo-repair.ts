/**
 * Responsabilidade do arquivo:
 * - Reparar typos evidentes com distancia lexical curta e mapa de substituicao.
 * - Manter reparo limitado a casos de alta confianca.
 * - Evitar alterar termos tecnicos desconhecidos.
 */
import { normalizeForComparison } from "../utils/accent-utils";
import { similarityScore } from "../utils/string-distance-utils";

export interface TypoRepairInput {
  text: string;
}

export interface TypoRepairResult {
  text: string;
  changed: boolean;
}

const TYPO_MAP: ReadonlyArray<[string, string]> = [
  ["ajsute", "ajuste"],
  ["reponsavel", "responsavel"],
  ["reponsabilidade", "responsabilidade"],
  ["linguisticoo", "linguistico"],
  ["documetacao", "documentacao"],
];

export function typoRepair(input: TypoRepairInput): TypoRepairResult {
  const originalText = `${input.text || ""}`;
  const repairToken = (token: string) => {
    const normalizedToken = normalizeForComparison(token);
    for (const [typo, fixed] of TYPO_MAP) {
      if (normalizedToken === typo || similarityScore(normalizedToken, typo) >= 0.9) {
        return fixed;
      }
    }
    return token;
  };

  const repairedText = originalText.replace(/\p{L}[\p{L}\p{N}'-]*/gu, (token) => repairToken(token));
  return {
    text: repairedText,
    changed: repairedText !== originalText,
  };
}

