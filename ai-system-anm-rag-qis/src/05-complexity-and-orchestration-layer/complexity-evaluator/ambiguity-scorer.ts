/**
 * Responsabilidade do arquivo:
 * - Estimar ambiguidade textual via snapshot compartilhado.
 * - Fornecer score de ambiguidade para roteamento e depth planning.
 */
import type { TextAnalysisSnapshot } from "../../shared/text-processing/text-analysis-snapshot";
import { buildTextAnalysisSnapshot } from "../../shared/text-processing/text-analysis-snapshot";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export interface AmbiguityScorerInput {
  text?: string;
  snapshot?: TextAnalysisSnapshot;
}

export function ambiguityScorer(input: AmbiguityScorerInput) {
  const snapshot = input.snapshot ?? buildTextAnalysisSnapshot(input.text || "");
  const shortMessagePenalty = snapshot.tokenCount < 5 ? 0.12 : 0;

  const score = clamp01(
    (Math.min(snapshot.ambiguousTermCount / 4, 1) * 0.52) +
    (Math.min(snapshot.pronounCount / 5, 1) * 0.24) +
    (Math.min(snapshot.questionCount / 3, 1) * 0.12) +
    shortMessagePenalty,
  );

  return {
    score,
    ambiguousTermCount: snapshot.ambiguousTermCount,
    pronounCount: snapshot.pronounCount,
    questionCount: snapshot.questionCount,
  };
}
