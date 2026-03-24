/**
 * Responsabilidade do arquivo:
 * - Orquestrar o modulo 18 completo (adapters -> serializers -> stream -> delivery).
 * - Produzir payload final por canal/formato com fallback seguro para rest/plain-text.
 * - Registrar diagnostico operacional do modulo no executionArtifacts e no trace.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import type { DeliveryChannel, DeliveryFormat, PresentationRenderModel, SerializedPresentation } from "./presentation-contracts";
import { isHttpUrl } from "./presentation-contracts";
import { ensureUtf8Response } from "./text-encoding-guard";
import { markdownSerializer } from "./output-serializer/markdown-serializer";
import { plainTextSerializer } from "./output-serializer/plain-text-serializer";
import { jsonBlockSerializer } from "./output-serializer/json-block-serializer";
import { richTextSerializer } from "./output-serializer/rich-text-serializer";
import { chatBubbleAdapter } from "./ui-render-adapter/chat-bubble-adapter";
import { citationAdapter } from "./ui-render-adapter/citation-adapter";
import { codeBlockAdapter } from "./ui-render-adapter/code-block-adapter";
import { confidenceAdapter } from "./ui-render-adapter/confidence-adapter";
import { documentBlockAdapter } from "./ui-render-adapter/document-block-adapter";
import { mediaAdapter } from "./ui-render-adapter/media-adapter";
import { buildPresentationFrontDelivery } from "./presentation-front-bridge";
import { buildPresentationStream } from "./presentation-stream-bridge";

function parseChannel(value: string | undefined): DeliveryChannel | null {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (normalized === "rest" || normalized === "sse" || normalized === "websocket") {
    return normalized;
  }
  return null;
}

function parseFormat(value: string | undefined): DeliveryFormat | null {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (normalized === "plain-text" || normalized === "markdown" || normalized === "json-block" || normalized === "rich-text") {
    return normalized;
  }
  return null;
}

function resolveDeliveryChannel(): DeliveryChannel {
  return parseChannel(process.env.KNX_PRESENTATION_CHANNEL) || "rest";
}

function resolveDeliveryFormat(channel: DeliveryChannel, hasCodeBlocks: boolean): DeliveryFormat {
  const explicit = parseFormat(process.env.KNX_PRESENTATION_FORMAT);
  if (explicit) return explicit;
  if (channel === "websocket") return "json-block";
  if (hasCodeBlocks) return "markdown";
  return "plain-text";
}

function selectSerialized(
  format: DeliveryFormat,
  serialized: Record<DeliveryFormat, SerializedPresentation>,
): SerializedPresentation {
  return serialized[format] || serialized["plain-text"];
}

export async function runPresentationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const utf8Guard = ensureUtf8Response(state.structuredResponse);
  const channel = resolveDeliveryChannel();

  const code = codeBlockAdapter({ text: utf8Guard.text });
  const bubble = chatBubbleAdapter({ text: code.cleanedText || utf8Guard.text });
  const citations = citationAdapter({ sources: state.retrievedSources });
  const documents = documentBlockAdapter({ sources: state.retrievedSources });
  const media = mediaAdapter({
    text: utf8Guard.text,
    sourceUrls: state.retrievedSources.map((source) => source.url),
  });
  const confidence = confidenceAdapter({
    scores: state.confidenceScores,
    validationReport: state.validationReport,
  });

  const format = resolveDeliveryFormat(channel, code.codeBlocks.length > 0);

  const renderModel: PresentationRenderModel = {
    channel,
    format,
    text: bubble.bubble.text,
    bubble: bubble.bubble,
    citations: citations.citations,
    codeBlocks: code.codeBlocks,
    documents: documents.documents,
    media: media.media,
    confidence: confidence.confidence,
  };

  const serializedMap: Record<DeliveryFormat, SerializedPresentation> = {
    "plain-text": plainTextSerializer({ model: renderModel }),
    markdown: markdownSerializer({ model: renderModel }),
    "json-block": jsonBlockSerializer({ model: renderModel }),
    "rich-text": richTextSerializer({ model: renderModel }),
  };

  const selectedSerialized = selectSerialized(format, serializedMap);
  const stream = buildPresentationStream({
    text: selectedSerialized.text,
    channel,
  });

  const front = buildPresentationFrontDelivery({
    channel,
    serialized: selectedSerialized,
    citations: citations.citations.filter((row) => isHttpUrl(row.url)).map((row) => row.url),
    stream: stream.serialized,
  });

  const finalCitations = citations.citations.filter((row) => isHttpUrl(row.url)).map((row) => row.url);
  const finalText = `${front.delivery.text || selectedSerialized.text || bubble.bubble.text}`.trim();

  state.structuredResponse = finalText;
  state.deliveryPayload = {
    channel: front.delivery.channel,
    format: front.delivery.format,
    text: finalText,
    citations: finalCitations,
  };

  state.executionArtifacts = {
    ...state.executionArtifacts,
    presentation: {
      channel: front.delivery.channel,
      format: front.delivery.format,
      selectedSerializer: selectedSerialized.format,
      adapters: [
        bubble.component,
        code.component,
        citations.component,
        documents.component,
        media.component,
        confidence.component,
      ],
      serializers: ["plain-text", "markdown", "json-block", "rich-text"],
      streamControllers: [
        "token-stream-manager",
        "sentence-buffering",
        "paragraph-flush-logic",
        "progressive-reveal-manager",
        "stream-recovery-manager",
      ],
      streamChunkCount: stream.serialized.chunkCount,
      streamRecovered: stream.recovered,
      retryPolicy: front.retryPolicy,
      utf8Repaired: utf8Guard.repaired,
    },
  };

  state.trace.push(
    makeTraceEvent({
      layer: "presentation",
      action: "delivery_payload_ready",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `channel=${front.delivery.channel}; format=${front.delivery.format}; serializer=${selectedSerialized.format}; ` +
        `utf8_repaired=${utf8Guard.repaired}; citations=${finalCitations.length}; stream_chunks=${stream.serialized.chunkCount}; recovered=${stream.recovered}`,
    }),
  );

  return state;
}
