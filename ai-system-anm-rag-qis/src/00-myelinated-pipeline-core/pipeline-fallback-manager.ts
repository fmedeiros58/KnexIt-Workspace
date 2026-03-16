import type { ProcessingState } from "../bridges/contracts/processing-state";

export function applyPipelineFallback(state: ProcessingState, reason: string): ProcessingState {
  state.validationReport.quality.decision = "retry";
  state.deliveryPayload.text = [
    "Nao consegui concluir a verificacao completa neste ciclo.",
    "Tente reformular a pergunta com mais contexto ou repetir em alguns segundos.",
    `Motivo tecnico: ${reason}`,
  ].join(" ");
  state.structuredResponse = state.deliveryPayload.text;
  return state;
}
