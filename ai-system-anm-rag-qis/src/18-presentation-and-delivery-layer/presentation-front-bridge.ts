import type { ProcessingState } from "../bridges/contracts/processing-state";
import { restDelivery } from "./front-delivery-layer/rest-delivery";
import { retryReconnectHandler } from "./front-delivery-layer/retry-reconnect-handler";
import { sseDelivery } from "./front-delivery-layer/sse-delivery";
import { websocketDelivery } from "./front-delivery-layer/websocket-delivery";
import type {
  DeliveryBuildResult,
  DeliveryChannel,
  SerializedPresentation,
} from "./presentation-contracts";
import type { StreamChunkSerializerOutput } from "./output-serializer/stream-chunk-serializer";

export interface PresentationFrontBridgeInput {
  channel: DeliveryChannel;
  serialized: SerializedPresentation;
  citations: string[];
  stream: StreamChunkSerializerOutput;
}

export interface PresentationFrontBridgeOutput {
  delivery: DeliveryBuildResult;
  retryPolicy: DeliveryBuildResult["retryPolicy"];
}

type DeliveryPayloadSnapshot = {
  channel?: unknown;
  format?: unknown;
  text?: unknown;
  citations?: unknown;
  serialized?: Partial<SerializedPresentation>;
  stream?: Partial<StreamChunkSerializerOutput>;
};

function readDeliveryPayload(state: ProcessingState): DeliveryPayloadSnapshot {
  return (state.deliveryPayload ?? undefined) as unknown as DeliveryPayloadSnapshot;
}

function normalizeText(value: string): string {
  return `${value || ""}`
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function resolveChannel(value: unknown): DeliveryChannel {
  return value === "sse" || value === "websocket" ? value : "rest";
}

function resolveFormat(value: unknown): SerializedPresentation["format"] {
  return typeof value === "string" && value.trim()
    ? (value as SerializedPresentation["format"])
    : ("plain-text" as SerializedPresentation["format"]);
}

function splitIntoStreamBlocks(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n{2,}/g)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length > 1) return blocks;

  const sentences = normalized
    .split(/(?<=[.!?])\s+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 3) return [normalized];

  const chunkSize = Math.max(2, Math.min(5, Math.ceil(sentences.length / 3)));
  const chunks: string[] = [];

  for (let i = 0; i < sentences.length; i += chunkSize) {
    chunks.push(sentences.slice(i, i + chunkSize).join(" ").trim());
  }

  return chunks.filter(Boolean);
}

function buildFallbackStream(text: string): StreamChunkSerializerOutput {
  const blocks = splitIntoStreamBlocks(text);
  const normalized = normalizeText(text);

  return {
    ok: true,
    component: "stream-chunk-serializer",
    score: blocks.length > 1 ? 0.82 : 0.72,
    text: normalized,
    chunkCount: Math.max(1, blocks.length),
  };
}

function resolveSerializedPresentation(
  state: ProcessingState,
  text: string,
): SerializedPresentation {
  const payload = readDeliveryPayload(state);
  const existingSerialized = payload.serialized;

  const format = resolveFormat(existingSerialized?.format ?? payload.format);
  const existingPayload =
    existingSerialized && typeof existingSerialized.payload === "object"
      ? existingSerialized.payload
      : undefined;

  return {
    format,
    text,
    payload: existingPayload ? { ...existingPayload, text } : { text },
    score:
      typeof existingSerialized?.score === "number" && Number.isFinite(existingSerialized.score)
        ? existingSerialized.score
        : 0.8,
  };
}

function resolveStream(
  state: ProcessingState,
  text: string,
): StreamChunkSerializerOutput {
  const payload = readDeliveryPayload(state);
  const existingStream = payload.stream;

  if (
    existingStream &&
    typeof existingStream.text === "string" &&
    normalizeText(existingStream.text) === text &&
    typeof existingStream.chunkCount === "number" &&
    existingStream.chunkCount >= 1
  ) {
    return {
      ok: typeof existingStream.ok === "boolean" ? existingStream.ok : true,
      component:
        typeof existingStream.component === "string"
          ? existingStream.component
          : "stream-chunk-serializer",
      score:
        typeof existingStream.score === "number" && Number.isFinite(existingStream.score)
          ? existingStream.score
          : 0.8,
      text,
      chunkCount: existingStream.chunkCount,
    };
  }

  return buildFallbackStream(text);
}

export function buildPresentationFrontDelivery(
  input: PresentationFrontBridgeInput,
): PresentationFrontBridgeOutput {
  const retry = retryReconnectHandler();

  if (input.channel === "sse") {
    return {
      delivery: sseDelivery({
        serializedText: input.serialized.text,
        stream: input.stream,
        retryPolicy: retry.policy,
      }),
      retryPolicy: retry.policy,
    };
  }

  if (input.channel === "websocket") {
    return {
      delivery: websocketDelivery({
        serializedText: input.serialized.text,
        stream: input.stream,
        retryPolicy: retry.policy,
      }),
      retryPolicy: retry.policy,
    };
  }

  return {
    delivery: restDelivery({
      serialized: input.serialized,
      citations: input.citations,
      retryPolicy: retry.policy,
    }),
    retryPolicy: retry.policy,
  };
}

export function handoffPresentationToFront(state: ProcessingState): ProcessingState {
  const payload = readDeliveryPayload(state);

  const text = normalizeText(
    `${payload.text || state.structuredResponse || state.finalResponse || ""}`,
  );

  if (!text) return state;

  const serialized = resolveSerializedPresentation(state, text);
  const stream = resolveStream(state, text);
  const channel = resolveChannel(payload.channel);
  const citations = Array.isArray(payload.citations)
    ? payload.citations.map((item) => `${item || ""}`.trim()).filter(Boolean)
    : [];

  const delivery = buildPresentationFrontDelivery({
    channel,
    serialized,
    citations,
    stream,
  });

  state.deliveryPayload = {
    ...state.deliveryPayload,
    channel: delivery.delivery.channel,
    format: delivery.delivery.format,
    text: delivery.delivery.text,
    citations,
  };

  return state;
}