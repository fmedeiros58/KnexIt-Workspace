import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildEpistemicCautions(state: ProcessingState): string[] {
  const cautions: string[] = [];
  if (state.collapsedTruth.uncertainty >= 0.45) cautions.push("Incerteza elevada: evitar linguagem categorica.");
  if (state.epistemicStatus === "contested") cautions.push("Hipotese contestada: declarar explicitamente conflitos.");
  if (!state.retrievedSources.length) cautions.push("Sem fontes recuperadas: resposta deve sinalizar limite de verificacao.");
  return cautions;
}
