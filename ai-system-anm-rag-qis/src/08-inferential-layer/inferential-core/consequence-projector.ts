import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function projectConsequences(state: ProcessingState): string[] {
  const consequences: string[] = [];
  consequences.push("Se o status epistemico for contestado, o usuario deve receber caminho de verificacao adicional.");
  if (state.retrievedSources.length < 2) {
    consequences.push("Baixa cobertura de fontes pode aumentar retrabalho em perguntas de continuidade.");
  }
  if (state.criticalCaveats.length > 0) {
    consequences.push("Caveats refletidos reduzem risco de overclaim em respostas longas.");
  }
  return consequences;
}
