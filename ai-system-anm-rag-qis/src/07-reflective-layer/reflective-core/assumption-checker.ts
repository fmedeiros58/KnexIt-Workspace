import type { ProcessingState } from "../../bridges/contracts/processing-state";

function hasBinaryFraming(message: string) {
  return /\b(sempre|nunca|obvio|certeza absoluta|100%)\b/i.test(message);
}

export function checkAssumptions(state: ProcessingState): string[] {
  const assumptions: string[] = [];
  if (!state.retrievedSources.length) assumptions.push("Sem fontes externas verificadas para sustentar a resposta.");
  if (state.recentTurns.length === 0) assumptions.push("Resposta baseada em contexto imediato, sem historico conversacional robusto.");
  if (hasBinaryFraming(state.normalizedMessage)) assumptions.push("A pergunta usa enquadramento binario que pode ocultar nuances.");
  if (state.collapsedTruth.uncertainty > 0.4) assumptions.push("A hipotese dominante ainda depende de incerteza residual elevada.");
  return assumptions;
}
