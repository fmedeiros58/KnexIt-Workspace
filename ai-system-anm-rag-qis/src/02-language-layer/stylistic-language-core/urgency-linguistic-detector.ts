/**
 * Responsabilidade do arquivo:
 * - Detectar linguagem de urgencia com score em [0,1].
 * - Marcar classe de urgencia para handoff linguistico.
 * - Manter leitura lexical transparente para auditoria.
 */
import type { UrgencySignalType } from "../types/language-signal-types";
import { clamp01 } from "../utils/normalization-utils";

export interface UrgencyLinguisticDetectorInput {
  text: string;
}

export interface UrgencyLinguisticDetectorResult {
  urgency: UrgencySignalType;
  urgencyScore: number;
}

export function urgencyLinguisticDetector(input: UrgencyLinguisticDetectorInput): UrgencyLinguisticDetectorResult {
  const text = `${input.text || ""}`.toLowerCase();
  const hits = (text.match(/\b(urgente|agora|imediato|pra ontem|asap|right now|today)\b/g) || []).length;
  const punctuationBoost = (text.match(/[!]{2,}/g) || []).length * 0.1;
  const urgencyScore = clamp01(hits * 0.24 + punctuationBoost);

  const urgency: UrgencySignalType = urgencyScore >= 0.7 ? "high" : urgencyScore >= 0.38 ? "medium" : "low";
  return { urgency, urgencyScore };
}

