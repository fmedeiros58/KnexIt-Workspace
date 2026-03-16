/**
 * Responsabilidade do arquivo:
 * - Detectar sinais de frustracao/insatisfacao no enunciado.
 * - Gerar score simples para calibracao de postura do sistema.
 * - Listar evidencias lexicais para auditoria.
 */
import { clamp01 } from "../utils/normalization-utils";

export interface FrustrationSignalDetectorInput {
  text: string;
}

export interface FrustrationSignalDetectorResult {
  frustrationScore: number;
  cues: string[];
}

export function frustrationSignalDetector(input: FrustrationSignalDetectorInput): FrustrationSignalDetectorResult {
  const text = `${input.text || ""}`.toLowerCase();
  const cues = text.match(/\b(frustrado|irritado|nao funciona|de novo|problema|erro|insatisfeito)\b/g) || [];
  return {
    frustrationScore: clamp01(cues.length * 0.22),
    cues: cues.slice(0, 12),
  };
}

