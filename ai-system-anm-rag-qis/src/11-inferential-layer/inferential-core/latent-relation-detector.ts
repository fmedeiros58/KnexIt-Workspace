import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function detectLatentRelations(state: ProcessingState): string[] {
  const relations: string[] = [];
  if (state.reflectiveNotes.tensions.length) {
    relations.push("Tensoes reflexivas elevadas tendem a reduzir fluidez da resposta sem reestruturacao textual.");
  }
  if (state.complexityProfile.ambiguity >= 0.4 && state.retrievedSources.length > 0) {
    relations.push("Ambiguidade combinada com evidencia parcial aumenta chance de interpretacao multipla.");
  }
  return relations;
}
