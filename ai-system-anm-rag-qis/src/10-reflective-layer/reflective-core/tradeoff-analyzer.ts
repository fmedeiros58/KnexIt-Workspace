import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function analyzeTradeoffs(state: ProcessingState): string[] {
  const tradeoffs: string[] = [];
  if (state.retrievedSources.length > 0) {
    tradeoffs.push("Mais cautela epistemica reduz risco de erro, mas pode diminuir objetividade da resposta.");
  }
  if (state.inferentialMap.implications.length === 0) {
    tradeoffs.push("Resposta direta tende a ser mais rapida, com menor exploracao de consequencias." );
  }
  if (state.complexityProfile.responseBudget < 220) {
    tradeoffs.push("Orcamento de resposta curto pode sacrificar contextualizacao critica.");
  }
  return tradeoffs;
}
