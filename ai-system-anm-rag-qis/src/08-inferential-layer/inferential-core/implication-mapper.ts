import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function mapImplications(state: ProcessingState): string[] {
  const implications: string[] = [];
  implications.push("A resposta final deve explicitar grau de certeza e base de evidencia.");
  if (state.retrievedSources.length > 0) {
    implications.push("Fontes recuperadas permitem atrelar afirmacoes a referencias observaveis.");
  }
  if (state.collapsedTruth.uncertainty > 0.4) {
    implications.push("Alta incerteza implica necessidade de formular resposta com condicionais.");
  }
  return implications;
}
