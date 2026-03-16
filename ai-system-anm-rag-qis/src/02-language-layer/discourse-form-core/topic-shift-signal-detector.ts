/**
 * Responsabilidade do arquivo:
 * - Detectar sinais explicitos de mudanca de topico no mesmo turno.
 * - Fornecer flag para continuidade conversacional.
 * - Evitar inferencias tematicas profundas fora da superficie textual.
 */
export interface TopicShiftSignalDetectorInput {
  text: string;
}

export interface TopicShiftSignalDetectorResult {
  topicShiftDetected: boolean;
  cues: string[];
}

export function topicShiftSignalDetector(input: TopicShiftSignalDetectorInput): TopicShiftSignalDetectorResult {
  const text = `${input.text || ""}`.toLowerCase();
  const cues = text.match(/\b(mudando de assunto|outro ponto|agora sobre|by the way|switching topics)\b/g) || [];
  return {
    topicShiftDetected: cues.length > 0,
    cues: cues.slice(0, 8),
  };
}

