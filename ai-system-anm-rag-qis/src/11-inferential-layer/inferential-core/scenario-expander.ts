import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function expandScenarios(state: ProcessingState): string[] {
  const scenarios: string[] = [
    "Cenario base: responder com sintese objetiva e nivel de confianca.",
  ];
  if (state.epistemicStatus === "contested") {
    scenarios.push("Cenario conflito: apresentar divergencias entre fontes e sugerir validacao externa.");
  }
  if (state.complexityProfile.score >= 0.65) {
    scenarios.push("Cenario complexo: priorizar decomposicao em etapas com conclusao progressiva.");
  }
  if (state.retrievedSources.length === 0) {
    scenarios.push("Cenario sem evidencia: declarar limite e orientar para coleta de fontes.");
  }
  return scenarios;
}
