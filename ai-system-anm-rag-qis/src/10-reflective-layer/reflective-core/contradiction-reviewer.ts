import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function reviewContradictions(state: ProcessingState): string[] {
  const contradictions: string[] = [];
  const top = state.hypothesisSet[0];
  if (top && top.contradictorySources.length) {
    contradictions.push("Existem sinais de contradicao entre fontes da hipotese dominante.");
  }
  if (state.retrievedSources.length >= 2) {
    const freshnessSpread = Math.max(...state.retrievedSources.map((item) => item.freshnessScore))
      - Math.min(...state.retrievedSources.map((item) => item.freshnessScore));
    if (freshnessSpread > 0.45) {
      contradictions.push("As fontes apresentam recencia desigual, aumentando risco de conflito temporal.");
    }
  }
  return contradictions;
}
