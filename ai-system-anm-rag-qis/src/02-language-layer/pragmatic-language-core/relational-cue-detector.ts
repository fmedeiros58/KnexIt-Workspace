/**
 * Responsabilidade do arquivo:
 * - Detectar pistas relacionais (tratamento nominal, proximidade, manutencao de vinculo).
 * - Fornecer sinais de relacao social sem inferencia psicologica profunda.
 * - Apoiar selecao de tom no conversation-layer.
 */
import { collectPatternMatches } from "../utils/phrase-pattern-utils";

export interface RelationalCueDetectorInput {
  text: string;
}

export interface RelationalCueDetectorResult {
  cues: string[];
}

export function relationalCueDetector(input: RelationalCueDetectorInput): RelationalCueDetectorResult {
  const namePreference = collectPatternMatches(input.text, /\b(me chame de|call me|pode me chamar de)\b/gi);
  const socialWarmth = collectPatternMatches(input.text, /\b(amigo|parceiro|obrigado|valeu|por gentileza)\b/gi);
  const boundarySignals = collectPatternMatches(input.text, /\b(sem enrolar|direto ao ponto|objetivo)\b/gi);

  return {
    cues: [...namePreference, ...socialWarmth, ...boundarySignals].map((value) => value.toLowerCase()).slice(0, 16),
  };
}

