import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function estimatePracticalImpacts(state: ProcessingState): string[] {
  const impacts: string[] = [];
  impacts.push("Clareza de status epistemico reduz risco de decisao com base em premissa fraca.");
  if (state.retrievedSources.length >= 2) {
    impacts.push("Maior diversidade de fontes tende a elevar confianca operacional da resposta.");
  }
  if (state.validationReport.quality.decision === "retry") {
    impacts.push("Quando a qualidade cai, acionar retry evita propagacao de resposta incompleta.");
  }
  return impacts;
}
