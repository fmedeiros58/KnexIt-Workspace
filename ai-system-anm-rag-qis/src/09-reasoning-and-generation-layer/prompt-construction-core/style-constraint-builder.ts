import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildStyleConstraints(state: ProcessingState): string {
  const base = ["Use linguagem objetiva e verificavel.", "Evite afirmacoes absolutas sem evidencia."];
  if (state.complexityProfile.score >= 0.65) base.push("Estruture resposta em blocos com progressao logica.");
  if (state.collapsedTruth.uncertainty > 0.4) base.push("Sinalize incerteza residual explicitamente.");
  return `Estilo: ${base.join(" ")}`;
}
