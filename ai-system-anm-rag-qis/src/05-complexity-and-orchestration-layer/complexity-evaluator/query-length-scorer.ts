/**
 * Responsabilidade do arquivo:
 * - Estimar complexidade por extensao textual usando snapshot compartilhado.
 * - Evitar tokenizacao redundante quando snapshot ja existir.
 */
import type { TextAnalysisSnapshot } from "../../shared/text-processing/text-analysis-snapshot";
import { buildTextAnalysisSnapshot } from "../../shared/text-processing/text-analysis-snapshot";

export interface QueryLengthScorerInput {
  text?: string;
  snapshot?: TextAnalysisSnapshot;
}

export function queryLengthScorer(input: QueryLengthScorerInput) {
  const snapshot = input.snapshot ?? buildTextAnalysisSnapshot(input.text || "");
  const score = Math.max(0, Math.min(1, snapshot.tokenCount / 42));

  return {
    score,
    tokenCount: snapshot.tokenCount,
    sentenceCount: snapshot.sentenceCount,
    avgSentenceLength: snapshot.avgSentenceLength,
  };
}
