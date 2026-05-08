/**
 * @file presentation-stream-bridge.ts
 * @description Constroi streams progressivos a partir do texto final ja saneado da camada de apresentacao.
 * @layer 18-presentation-and-delivery-layer
 * @purpose Evitar que chunks progressivos reintroduzam historico, rotulos de fala ou artefatos internos no front-end.
 * @inputs ProcessingState ou texto final com canal de entrega e plano opcional de layout.
 * @outputs Chunks, stream serializado e metadado de recuperacao do stream.
 * @dependsOn Filtro de artefatos internos, guardas UTF-8, controladores de streaming e serializer de chunks.
 * @usedBy Ponte de apresentacao antes do handoff aos canais REST, SSE e WebSocket.
 * @invariants O stream deve representar apenas o texto final limpo, sem continuidade interna nem transcricao de conversa.
 * @notes O saneamento aqui replica a defesa final porque streams podem ser gerados antes da ponte de front-end.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { filterInternalArtifacts } from "../15-response-structure-engine/internal-artifact-filter";
import { ensureUtf8Response } from "./text-encoding-guard";
import { streamChunkSerializer, type StreamChunkSerializerOutput } from "./output-serializer/stream-chunk-serializer";
import type { DeliveryChannel, StreamChunk } from "./presentation-contracts";
import { paragraphFlushLogic } from "./streaming-controller/paragraph-flush-logic";
import { progressiveRevealManager } from "./streaming-controller/progressive-reveal-manager";
import { sentenceBuffering } from "./streaming-controller/sentence-buffering";
import { streamRecoveryManager } from "./streaming-controller/stream-recovery-manager";
import { tokenStreamManager } from "./streaming-controller/token-stream-manager";
import type { ResponseLayoutPlan } from "./textual-layout-engine/response-layout-types";

export interface PresentationStreamBridgeInput {
  text: string;
  channel: DeliveryChannel;
  layoutPlan?: ResponseLayoutPlan;
}

export interface PresentationStreamBridgeOutput {
  chunks: StreamChunk[];
  serialized: StreamChunkSerializerOutput;
  recovered: boolean;
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeForCompare(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”"'`´]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function stripRoleTranscriptTail(value: string): string {
  const source = `${value || ""}`.trim();
  if (!source) return "";

  const roleTailPattern = /\b(?:usu[aá]rio|usuario|user|assistente|assistant|let[ií]cia|leticia)\s*:\s*|\blet[ií]cia(?=\s*:|[A-ZÁÉÍÓÚÂÊÔÃÕ]|Sim|Nao|Não)|(?:^|[^A-Za-z0-9_]|\\n)(?:continuidade|continuity\\*_anchor|continuity\\*_mode)\s*:|\bexplica[cç][aã]o\s*:\s*(?:$|\n|\\n|a pergunta do usu[aá]rio|a minha resposta|nao houve necessidade|não houve necessidade)|\bpensou por \d+\s*(?:ms|s)\b/i;
  const match = roleTailPattern.exec(source);
  if (!match || match.index <= 0) return source;

  const head = source.slice(0, match.index).trim();
  return head || source;
}

function splitParagraphs(text: string): string[] {
  return `${text || ""}`
    .split(/\n{2,}/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function dedupeConsecutiveParagraphs(text: string): string {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length <= 1) return `${text || ""}`.trim();

  const kept: string[] = [];

  for (const paragraph of paragraphs) {
    const last = kept[kept.length - 1];
    if (!last) {
      kept.push(paragraph);
      continue;
    }

    if (normalizeForCompare(last) === normalizeForCompare(paragraph)) {
      continue;
    }

    kept.push(paragraph);
  }

  return kept.join("\n\n").trim();
}

function collapseDuplicatedHalves(text: string): string {
  const source = `${text || ""}`.trim();
  if (!source || source.length < 260) return source;

  const sentences = source
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((row) => row.trim())
    .filter(Boolean);

  if (sentences.length < 8) return source;

  const midpoint = Math.floor(sentences.length / 2);
  const firstHalf = sentences.slice(0, midpoint);
  const secondHalf = sentences.slice(midpoint, midpoint + firstHalf.length);

  if (firstHalf.length < 3 || secondHalf.length < 3) return source;

  let equal = 0;
  const comparable = Math.min(firstHalf.length, secondHalf.length);

  for (let i = 0; i < comparable; i += 1) {
    if (normalizeForCompare(firstHalf[i]) === normalizeForCompare(secondHalf[i])) {
      equal += 1;
    }
  }

  const ratio = equal / Math.max(1, comparable);
  if (ratio < 0.65) return source;

  return firstHalf.join(" ").trim();
}

function sanitizeStreamText(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  const artifactFiltered = filterInternalArtifacts(utf8).text;
  const withoutLabels = stripDialogueLabels(artifactFiltered);
  const withoutTail = stripRoleTranscriptTail(withoutLabels);
  const deduped = dedupeConsecutiveParagraphs(withoutTail);
  const collapsed = collapseDuplicatedHalves(deduped);
  return collapseWhitespace(collapsed);
}

function normalizeStreamText(state: ProcessingState): string {
  const candidate =
    `${state.structuredResponse || state.finalResponse || state.deliveryPayload?.text || ""}`.trim();

  return sanitizeStreamText(candidate);
}

function resolveStreamChannel(channel: DeliveryChannel): DeliveryChannel {
  return channel === "sse" || channel === "websocket" ? channel : "rest";
}

export function buildPresentationStream(
  input: PresentationStreamBridgeInput,
): PresentationStreamBridgeOutput {
  const sourceText = sanitizeStreamText(input.text);

  if (!sourceText) {
    return {
      chunks: [],
      serialized: {
        ok: true,
        component: "stream-chunk-serializer",
        score: 0.35,
        text: "",
        chunkCount: 0,
      },
      recovered: false,
    };
  }

  const tokens = tokenStreamManager({ text: sourceText });

  const sentences = sentenceBuffering({
    tokens: tokens.tokens,
    layoutPlan: input.layoutPlan,
  });

  const paragraphs = paragraphFlushLogic({
    sentences: sentences.sentences,
    layoutPlan: input.layoutPlan,
  });

  const reveal = progressiveRevealManager({
    paragraphs: paragraphs.paragraphs,
    layoutPlan: input.layoutPlan,
  });

  const recovered = streamRecoveryManager({
    chunks: reveal.chunks,
    fallbackText: sourceText,
  });

  const mode =
    input.channel === "sse"
      ? "sse"
      : input.channel === "websocket"
        ? "websocket"
        : "plain";

  const serialized = streamChunkSerializer({
    chunks: recovered.chunks,
    mode,
  });

  return {
    chunks: recovered.chunks,
    serialized: {
      ...serialized,
      text: sanitizeStreamText(serialized.text),
    },
    recovered: recovered.recovered,
  };
}

export function handoffPresentationToStream(state: ProcessingState): ProcessingState {
  const text = normalizeStreamText(state);
  if (!text) return state;

  const channel = resolveStreamChannel(state.deliveryPayload?.channel || "rest");

  const stream = buildPresentationStream({
    text,
    channel,
  });

  state.deliveryPayload = {
    ...state.deliveryPayload,
    text,
    payload: {
      ...(state.deliveryPayload?.payload || {}),
      streamText: stream.serialized.text,
      streamChunkCount: stream.serialized.chunkCount,
      streamRecovered: stream.recovered,
    },
  };

  state.executionArtifacts = {
    ...state.executionArtifacts,
    presentation: {
      ...(state.executionArtifacts.presentation || {
        channel: state.deliveryPayload?.channel || "rest",
        format: state.deliveryPayload?.format || "plain-text",
        selectedSerializer: state.deliveryPayload?.format || "plain-text",
        adapters: [],
        serializers: [],
        streamControllers: [],
        streamChunkCount: 0,
        streamRecovered: false,
        retryPolicy: { maxAttempts: 0, baseBackoffMs: 0, jitterMs: 0 },
        utf8Repaired: false,
      }),
      streamChunkCount: stream.serialized.chunkCount,
      streamRecovered: stream.recovered,
    },
  };

  return state;
}
