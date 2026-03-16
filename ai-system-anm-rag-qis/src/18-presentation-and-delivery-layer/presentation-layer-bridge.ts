/**
 * Responsabilidade do arquivo:
 * - Montar payload final de entrega ao usuario.
 * - Aplicar guarda de UTF-8 no texto final para reduzir mojibake.
 * - Registrar no trace se houve reparo de encoding na saida.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { ensureUtf8Response } from "./text-encoding-guard";

export async function runPresentationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const utf8Guard = ensureUtf8Response(state.structuredResponse);
  const finalText = utf8Guard.repaired
    ? `${utf8Guard.text}\n\n[encoding: UTF-8 normalizado]`
    : utf8Guard.text;

  state.deliveryPayload = {
    channel: "rest",
    format: "plain-text",
    text: finalText,
    citations: state.retrievedSources.map((source) => source.url),
  };

  state.trace.push(
    makeTraceEvent({
      layer: "presentation",
      action: "delivery_payload_ready",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `utf8_repaired=${utf8Guard.repaired}`,
    }),
  );

  return state;
}
