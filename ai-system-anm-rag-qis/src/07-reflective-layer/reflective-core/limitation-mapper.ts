import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function mapLimitations(state: ProcessingState): string[] {
  const limits: string[] = [];
  if (state.retrievedEvidence.length < 2) limits.push("Base de evidencia curta para afirmacoes fortes.");
  if (state.complexityProfile.score >= 0.7 && state.hypothesisSet.length < 3) {
    limits.push("Alta complexidade com baixa diversidade de hipoteses concorrentes.");
  }
  if (state.epistemicStatus === "insufficient-evidence") {
    limits.push("Estado epistemico indica evidencia insuficiente para fechamento assertivo.");
  }
  return limits;
}
