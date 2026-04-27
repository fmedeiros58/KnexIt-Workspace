/**
 * @file pipeline-delivery-handoff.ts
 * @description Fecha o payload de entrega do pipeline sem desfazer a limpeza da camada de apresentacao.
 * @layer 00-myelinated-pipeline-core
 * @purpose Evitar que structuredResponse contaminado sobrescreva deliveryPayload final ja saneado.
 * @inputs ProcessingState apos execucao descendente do pipeline.
 * @outputs ProcessingState com texto de entrega e citacoes finais.
 * @dependsOn processing-state, filtro de artefatos internos e guarda UTF-8.
 * @usedBy pipeline-conductor.
 * @invariants A entrega final da camada 18 nao pode ser sobrescrita por texto bruto ou contaminado.
 * @notes Este handoff roda depois da apresentacao; por isso deve ser conservador com deliveryPayload existente.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { filterInternalArtifacts } from "../15-response-structure-engine/internal-artifact-filter";
import { ensureUtf8Response } from "../18-presentation-and-delivery-layer/text-encoding-guard";

function isPublicCitationUrl(url: string) {
  return /^https?:\/\//i.test(`${url || ""}`.trim());
}

function sanitizePlainDeliveryText(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  return filterInternalArtifacts(utf8).text.trim();
}

function hasPresentationDelivery(state: ProcessingState): boolean {
  const presentation = state.executionArtifacts.presentation;
  return Boolean(
    presentation &&
      (presentation.channel || presentation.format || presentation.selectedSerializer) &&
      `${state.deliveryPayload.text || ""}`.trim(),
  );
}

export function handoffPipelineDelivery(state: ProcessingState) {
  const structured = sanitizePlainDeliveryText(`${state.structuredResponse || ""}`);
  const currentDelivery = `${state.deliveryPayload.text || ""}`.trim();

  if (hasPresentationDelivery(state)) {
    state.deliveryPayload.text = currentDelivery;
  } else if (structured) {
    state.deliveryPayload.text = structured;
  } else if (currentDelivery) {
    state.deliveryPayload.text = sanitizePlainDeliveryText(currentDelivery) || currentDelivery;
  }

  const hasPresentationCitations =
    Array.isArray(state.deliveryPayload.citations) && state.deliveryPayload.citations.length > 0;

  if (!hasPresentationCitations) {
    state.deliveryPayload.citations = state.retrievedSources
      .map((source) => `${source.url || ""}`.trim())
      .filter((url) => isPublicCitationUrl(url));
  }

  return state;
}
