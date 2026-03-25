/**
 * Responsabilidade do arquivo:
 * - Estimar complexidade semantica superficial via snapshot textual.
 * - Produzir score consistente e barato para orchestration.
 */
import type { TextAnalysisSnapshot } from "../../shared/text-processing/text-analysis-snapshot";
import { buildTextAnalysisSnapshot } from "../../shared/text-processing/text-analysis-snapshot";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export interface SemanticComplexityScorerInput {
  text?: string;
  snapshot?: TextAnalysisSnapshot;
}

export function semanticComplexityScorer(input: SemanticComplexityScorerInput) {
  const snapshot = input.snapshot ?? buildTextAnalysisSnapshot(input.text || "");

  const score = clamp01(
    (snapshot.longTokenRatio * 0.34) +
    (Math.min(snapshot.connectiveCount / 5, 1) * 0.24) +
    (Math.min(snapshot.modalCount / 4, 1) * 0.12) +
    (Math.min(snapshot.negationCount / 4, 1) * 0.10) +
    (Math.min(snapshot.avgSentenceLength / 18, 1) * 0.20),
  );

  return {
    score,
    longTokenRatio: snapshot.longTokenRatio,
    connectiveCount: snapshot.connectiveCount,
    modalCount: snapshot.modalCount,
    negationCount: snapshot.negationCount,
    avgSentenceLength: snapshot.avgSentenceLength,
  };
}
