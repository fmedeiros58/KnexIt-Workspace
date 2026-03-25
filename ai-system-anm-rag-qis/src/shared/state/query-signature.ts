import { textNormalizationService } from "../text-processing/text-normalization.service";

/**
 * Responsabilidade do arquivo:
 * - Gerar assinatura compacta e deterministica para consultas textuais.
 * - Permitir cache leve de retrieval por query equivalente.
 * - Evitar repeticao de trabalho para perguntas identicas ou quase identicas.
 */
export function buildQuerySignature(text: string) {
  const normalized = textNormalizationService.fingerprint(text || "");
  if (!normalized) return "qsig:0";

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(index);
    hash |= 0;
  }

  return `qsig:${Math.abs(hash)}`;
}
