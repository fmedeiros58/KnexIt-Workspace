/**
 * Responsabilidade do arquivo:
 * - Medir forca diretiva da fala (grau de imperatividade no pedido).
 * - Diferenciar solicitacao suave de comando forte.
 * - Expor score unico para calibracao de resposta.
 */
import { clamp01, safeLower } from "../utils/normalization-utils";

export interface DirectiveForceDetectorInput {
  text: string;
}

export interface DirectiveForceDetectorResult {
  force: number;
}

export function directiveForceDetector(input: DirectiveForceDetectorInput): DirectiveForceDetectorResult {
  const text = safeLower(input.text);
  const directVerbs = (text.match(/\b(implemente|crie|ajuste|corrija|faca|resolva|remova|adicione)\b/g) || []).length;
  const softened = (text.match(/\b(poderia|se possivel|quando puder|talvez)\b/g) || []).length;

  const raw = 0.2 + directVerbs * 0.2 - softened * 0.12 + (/!/.test(text) ? 0.08 : 0);
  return { force: clamp01(raw) };
}

