/**
 * @file presentation-front-bridge.ts
 * @description Conecta a resposta serializada da camada de apresentação aos canais REST, SSE e WebSocket usados pelo front-end.
 * @layer 18-presentation-and-delivery-layer
 * @purpose Evitar que payloads streamados sejam tratados como texto final e garantir handoff completo para o canal de entrega.
 * @inputs ProcessingState com deliveryPayload, structuredResponse, finalResponse e metadados de canal.
 * @outputs ProcessingState com deliveryPayload normalizado e pronto para entrega ao front-end.
 * @dependsOn Contratos de processamento, serializers de stream e entregadores REST/SSE/WebSocket.
 * @usedBy Pipeline descendente na etapa de apresentação e entrega ao front-end.
 * @invariants O texto semântico final nunca deve ser substituído por um corpo SSE/WebSocket já serializado.
 * @notes Mantém reaproveitamento de streams existentes quando o canal é compatível, mas reconstrói o texto-base a partir da resposta limpa.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { restDelivery } from "./front-delivery-layer/rest-delivery";
import { retryReconnectHandler } from "./front-delivery-layer/retry-reconnect-handler";
import { sseDelivery } from "./front-delivery-layer/sse-delivery";
import { websocketDelivery } from "./front-delivery-layer/websocket-delivery";
import { buildFinalDeliveryIntegrityReport } from "./final-delivery-integrity-report-builder";
import { filterInternalArtifacts } from "../15-response-structure-engine/internal-artifact-filter";
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

type SerializerMode = "plain" | "sse" | "websocket";

function readDeliveryPayload(state: ProcessingState): DeliveryPayloadSnapshot {
  return (state.deliveryPayload ?? undefined) as DeliveryPayloadSnapshot;
}

function normalizeLineEndings(value: string): string {
  return `${value || ""}`.replace(/\r\n?/g, "\n");
}

function stripLeakedTranscriptTail(value: string): string {
  const source = normalizeLineEndings(value).trim();
  if (!source) {
    return "";
  }

  const marker = /\b(?:usu[aá]rio|usuario|user|assistente|assistant)\s*:|\blet[ií]cia\s*:|\blet[ií]cia(?=\s*:|[A-ZÁÉÍÓÚÂÊÔÃÕ]|Sim|Nao|Não)|(?:^|[^A-Za-z0-9_]|\\n)(?:continuidade|continuity\\*_anchor|continuity\\*_mode)\s*:|\bexplica[cç][aã]o\s*:\s*(?:$|\n|\\n|a pergunta do usu[aá]rio|a minha resposta|nao houve necessidade|não houve necessidade)|\bpensou por \d+\s*(?:ms|s)\b/i.exec(source);
  if (!marker || marker.index <= 0) {
    return source;
  }

  const head = source.slice(0, marker.index).trim();
  return head.length >= 6 ? head : source;
}

function containsLeakedTranscriptMarker(value: string): boolean {
  const normalized = normalizeLineEndings(value);
  const filtered = filterInternalArtifacts(normalized);
  if (filtered.removedCount > 0) {
    return true;
  }

  return /\b(?:usu(?:a|\u00e1|\u00c3\u00a1|\uFFFD|\u00ef\u00bf\u00bd|\?)rio|usuario|user|assistente|assistant)\s*:|\blet(?:i|\u00ed|\u00c3\u00ad|\uFFFD|\u00ef\u00bf\u00bd|\?)cia\s*:|\blet(?:i|\u00ed|\u00c3\u00ad|\uFFFD|\u00ef\u00bf\u00bd|\?)cia(?=\s*:|[A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00c2\u00ca\u00d4\u00c3\u00d5]|Sim|Nao|N\u00e3o|Desculpe|Obrigado|Ola|Ol\u00e1)|(?:^|[^A-Za-z0-9_]|\\n)(?:continuidade|continuity\\*_anchor|continuity\\*_mode)\s*:|\bexplica(?:c|\u00e7|\u00c3\u00a7)(?:a|\u00e3|\u00c3\u00a3)o\s*:\s*(?:$|\n|\\n|a pergunta do usu(?:a|\u00e1|\u00c3\u00a1|\uFFFD|\u00ef\u00bf\u00bd|\?)rio|a minha resposta|nao houve necessidade|n\u00e3o houve necessidade)|\bpensou por \d+\s*(?:ms|s)\b/i.test(
    normalized,
  );
}

function normalizeText(value: string): string {
  const artifactFiltered = filterInternalArtifacts(`${value || ""}`).text;
  return stripLeakedTranscriptTail(artifactFiltered)
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
  if (!normalized) {
    return [];
  }

  const paragraphBlocks = normalized
    .split(/\n{2,}/g)
    .map((block) => block.trim())
    .filter(Boolean);

  if (paragraphBlocks.length > 1) {
    return paragraphBlocks;
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 2) {
    return [normalized];
  }

  const chunkSize = Math.max(1, Math.min(4, Math.ceil(sentences.length / 3)));
  const chunks: string[] = [];

  for (let index = 0; index < sentences.length; index += chunkSize) {
    chunks.push(sentences.slice(index, index + chunkSize).join(" ").trim());
  }

  return chunks.filter(Boolean);
}

function buildSseChunk(index: number, delta: string, cumulativeText: string, done: boolean): string {
  return `event: chunk\ndata: ${JSON.stringify({ index, delta, cumulativeText, done })}\n\n`;
}

function buildSseDone(text: string): string {
  return `event: done\ndata: ${JSON.stringify({ done: true, text })}\n\n`;
}

function buildWebsocketChunk(index: number, delta: string, cumulativeText: string, done: boolean): string {
  return JSON.stringify({
    type: "chunk",
    index,
    delta,
    cumulativeText,
    done,
  });
}

function buildWebsocketDone(text: string): string {
  return JSON.stringify({
    type: "done",
    text,
    done: true,
  });
}

function buildFallbackStream(text: string, mode: SerializerMode): StreamChunkSerializerOutput {
  const blocks = splitIntoStreamBlocks(text);
  const normalized = normalizeText(text);

  if (mode === "plain") {
    return {
      ok: true,
      component: "stream-chunk-serializer",
      score: blocks.length > 1 ? 0.82 : 0.72,
      text: normalized,
      chunkCount: Math.max(1, blocks.length || (normalized ? 1 : 0)),
    };
  }

  const effectiveBlocks = blocks.length ? blocks : normalized ? [normalized] : [];
  let cumulative = "";

  if (mode === "sse") {
    const lines: string[] = [];

    effectiveBlocks.forEach((block, index) => {
      cumulative += block;
      lines.push(buildSseChunk(index, block, cumulative, false));
    });

    lines.push(buildSseDone(normalized));

    return {
      ok: true,
      component: "stream-chunk-serializer",
      score: effectiveBlocks.length > 1 ? 0.82 : 0.72,
      text: lines.join(""),
      chunkCount: Math.max(1, effectiveBlocks.length || (normalized ? 1 : 0)),
    };
  }

  const lines: string[] = [];

  effectiveBlocks.forEach((block, index) => {
    cumulative += block;
    lines.push(buildWebsocketChunk(index, block, cumulative, false));
  });

  lines.push(buildWebsocketDone(normalized));

  return {
    ok: true,
    component: "stream-chunk-serializer",
    score: effectiveBlocks.length > 1 ? 0.82 : 0.72,
    text: lines.join("\n"),
    chunkCount: Math.max(1, effectiveBlocks.length || (normalized ? 1 : 0)),
  };
}

function looksLikeSseStream(text: string): boolean {
  const normalized = normalizeLineEndings(text).trim();
  return /(?:^|\n)event:\s*(chunk|done)\s*\n/i.test(normalized) && /(?:^|\n)data:\s*/i.test(normalized);
}

function looksLikeWebsocketStream(text: string): boolean {
  const lines = normalizeLineEndings(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return false;
  }

  return lines.every((line) => {
    try {
      const parsed = JSON.parse(line) as { type?: unknown; done?: unknown };
      return parsed && typeof parsed === "object" && ("type" in parsed || "done" in parsed);
    } catch {
      return false;
    }
  });
}

function coerceTextCandidate(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function chooseSemanticText(
  payload: DeliveryPayloadSnapshot,
  state: ProcessingState,
  channel: DeliveryChannel,
): string {
  const serializedText = coerceTextCandidate(payload.serialized?.text);
  if (serializedText.trim()) {
    return serializedText;
  }

  const structuredResponse = coerceTextCandidate(state.structuredResponse);
  if (structuredResponse.trim()) {
    return structuredResponse;
  }

  const finalResponse = coerceTextCandidate(state.finalResponse);
  if (finalResponse.trim()) {
    return finalResponse;
  }

  const payloadText = coerceTextCandidate(payload.text);
  if (channel !== "rest" && (looksLikeSseStream(payloadText) || looksLikeWebsocketStream(payloadText))) {
    return "";
  }

  return payloadText;
}

function resolveSerializedPresentation(state: ProcessingState, text: string): SerializedPresentation {
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
  channel: DeliveryChannel,
): StreamChunkSerializerOutput {
  const payload = readDeliveryPayload(state);
  const existingStream = payload.stream;
  const serializerMode: SerializerMode =
    channel === "sse" ? "sse" : channel === "websocket" ? "websocket" : "plain";

  if (
    existingStream &&
    typeof existingStream.text === "string" &&
    typeof existingStream.chunkCount === "number" &&
    existingStream.chunkCount >= 1
  ) {
    const streamText = normalizeLineEndings(existingStream.text);

    if (channel === "rest") {
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
        text: normalizeText(text),
        chunkCount: existingStream.chunkCount,
      };
    }

    if (channel === "sse" && looksLikeSseStream(streamText) && !containsLeakedTranscriptMarker(streamText)) {
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
        text: streamText,
        chunkCount: existingStream.chunkCount,
      };
    }

    if (channel === "websocket" && looksLikeWebsocketStream(streamText) && !containsLeakedTranscriptMarker(streamText)) {
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
        text: streamText,
        chunkCount: existingStream.chunkCount,
      };
    }
  }

  return buildFallbackStream(text, serializerMode);
}

export function buildPresentationFrontDelivery(
  input: PresentationFrontBridgeInput,
): PresentationFrontBridgeOutput {
  const retry = retryReconnectHandler();
  const text = normalizeText(input.serialized.text);
  const serialized: SerializedPresentation = {
    ...input.serialized,
    text,
    payload:
      input.serialized.payload && typeof input.serialized.payload === "object"
        ? { ...input.serialized.payload, text }
        : { text },
  };
  const stream =
    text !== input.serialized.text || containsLeakedTranscriptMarker(input.stream.text)
      ? buildFallbackStream(
          text,
          input.channel === "sse" ? "sse" : input.channel === "websocket" ? "websocket" : "plain",
        )
      : input.stream;

  if (input.channel === "sse") {
    return {
      delivery: sseDelivery({
        serializedText: serialized.text,
        stream,
        retryPolicy: retry.policy,
      }),
      retryPolicy: retry.policy,
    };
  }

  if (input.channel === "websocket") {
    return {
      delivery: websocketDelivery({
        serializedText: serialized.text,
        stream,
        retryPolicy: retry.policy,
      }),
      retryPolicy: retry.policy,
    };
  }

  return {
    delivery: restDelivery({
      serialized,
      citations: input.citations,
      retryPolicy: retry.policy,
    }),
    retryPolicy: retry.policy,
  };
}

export function handoffPresentationToFront(state: ProcessingState): ProcessingState {
  const payload = readDeliveryPayload(state);
  const channel = resolveChannel(payload.channel);

  const text = normalizeText(chooseSemanticText(payload, state, channel));

  if (!text) {
    return state;
  }

  const serialized = resolveSerializedPresentation(state, text);
  const stream = resolveStream(state, text, channel);
  const citations = Array.isArray(payload.citations)
    ? payload.citations.map((item) => `${item || ""}`.trim()).filter(Boolean)
    : [];

  const delivery = buildPresentationFrontDelivery({
    channel,
    serialized,
    citations,
    stream,
  });
  const finalDeliveryIntegrity = buildFinalDeliveryIntegrityReport({
    channel,
    semanticText: serialized.text,
    deliveryText: delivery.delivery.text,
  });

  state.deliveryPayload = {
    ...state.deliveryPayload,
    channel: delivery.delivery.channel,
    format: delivery.delivery.format,
    text: delivery.delivery.text,
    citations,
    payload: {
      ...(delivery.delivery.payload || {}),
      finalDeliveryIntegrity,
    },
  };

  state.executionArtifacts.presentation = {
    ...(state.executionArtifacts.presentation || {
      channel: delivery.delivery.channel,
      format: delivery.delivery.format,
      selectedSerializer: "unknown",
      adapters: [],
      serializers: [],
      streamControllers: [],
      streamChunkCount: 0,
      streamRecovered: false,
      retryPolicy: delivery.retryPolicy,
      utf8Repaired: false,
    }),
    finalDeliveryIntegrity,
  };

  return state;
}
