/**
 * @file stream-chunk-serializer.ts
 * @description Serializa chunks incrementais em texto plano, SSE ou WebSocket preservando texto acumulado confiável.
 * @layer 18-presentation-and-delivery-layer
 * @purpose Evitar perda, duplicação ou contaminação de chunks durante a entrega progressiva ao front-end.
 * @inputs Lista de StreamChunk e modo de serialização desejado.
 * @outputs Texto serializado, quantidade de chunks e score de integridade da serialização.
 * @dependsOn Contratos de apresentação e guarda de codificação UTF-8.
 * @usedBy Ponte de apresentação e canais de entrega REST/SSE/WebSocket.
 * @invariants Rótulos de transcrição não podem vazar para o texto acumulado e chunks duplicados não devem ser reenviados.
 * @notes A escolha do maior cumulativeText preserva respostas finais completas quando deltas chegam fragmentados ou redundantes.
 */
import type { StreamChunk } from "../presentation-contracts";
import { ensureUtf8Response } from "../text-encoding-guard";
import { filterInternalArtifacts } from "../../15-response-structure-engine/internal-artifact-filter";

export interface StreamChunkSerializerInput {
  chunks: StreamChunk[];
  mode?: "plain" | "sse" | "websocket";
}

export interface StreamChunkSerializerOutput {
  ok: boolean;
  component: string;
  score: number;
  text: string;
  chunkCount: number;
}

type SerializerMode = "plain" | "sse" | "websocket";

function resolveMode(value: StreamChunkSerializerInput["mode"]): SerializerMode {
  return value === "sse" || value === "websocket" ? value : "plain";
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function stripUnsafeControlChars(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function stripRoleTranscriptTail(value: string): string {
  const source = `${value || ""}`.trim();
  if (!source) {
    return "";
  }

  const roleTailPattern = /\b(?:usu[aá]rio|usuario|user|assistente|assistant|let[ií]cia|leticia)\s*:\s*|\blet[ií]cia(?=\s*:|[A-ZÁÉÍÓÚÂÊÔÃÕ]|Sim|Nao|Não)|(?:^|[^A-Za-z0-9_]|\\n)(?:continuidade|continuity\\*_anchor|continuity\\*_mode)\s*:|\bexplica[cç][aã]o\s*:\s*(?:$|\n|\\n|a pergunta do usu[aá]rio|a minha resposta|nao houve necessidade|não houve necessidade)|\bpensou por \d+\s*(?:ms|s)\b/i;
  const match = roleTailPattern.exec(source);
  if (!match || match.index <= 0) {
    return source;
  }

  const head = source.slice(0, match.index).trim();
  return head || source;
}

function sanitizeChunkPayload(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  const artifactFiltered = filterInternalArtifacts(utf8).text;
  return stripUnsafeControlChars(normalizeLineEndings(stripRoleTranscriptTail(stripDialogueLabels(artifactFiltered))));
}

function isFiniteIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function appendDelta(previous: string, delta: string): string {
  if (!previous) return delta;
  if (!delta) return previous;
  return `${previous}${delta}`;
}

function chooseBestCumulativeText(chunks: StreamChunk[]): string {
  let best = "";

  for (const chunk of chunks) {
    const candidate = sanitizeChunkPayload(chunk.cumulativeText || "");
    if (!candidate) {
      continue;
    }

    if (candidate.length > best.length) {
      best = candidate;
      continue;
    }

    if (candidate.length === best.length && candidate !== best) {
      best = candidate;
    }
  }

  return best;
}

function isExactDuplicateChunk(previous: StreamChunk | undefined, current: StreamChunk): boolean {
  if (!previous) {
    return false;
  }

  return (
    previous.delta === current.delta &&
    previous.cumulativeText === current.cumulativeText &&
    previous.done === current.done
  );
}

function normalizeChunks(value: StreamChunk[] | undefined): StreamChunk[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  const sanitized: StreamChunk[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    if (!isFiniteIndex((item as StreamChunk).index)) {
      continue;
    }

    if (typeof (item as StreamChunk).delta !== "string") {
      continue;
    }

    if (typeof (item as StreamChunk).done !== "boolean") {
      continue;
    }

    const delta = sanitizeChunkPayload((item as StreamChunk).delta || "");
    const cumulativeCandidate = sanitizeChunkPayload((item as StreamChunk).cumulativeText || "");
    const previous = sanitized[sanitized.length - 1];

    if (!delta && !cumulativeCandidate && !(item as StreamChunk).done) {
      continue;
    }

    const cumulativeText = cumulativeCandidate || appendDelta(previous?.cumulativeText || "", delta);

    const nextChunk: StreamChunk = {
      index: sanitized.length,
      delta,
      cumulativeText,
      done: Boolean((item as StreamChunk).done),
    };

    if (isExactDuplicateChunk(previous, nextChunk)) {
      continue;
    }

    sanitized.push(nextChunk);
  }

  return sanitized;
}

function toSseChunk(chunk: StreamChunk): string {
  const payload = JSON.stringify({
    index: chunk.index,
    delta: chunk.delta,
    cumulativeText: chunk.cumulativeText || "",
    done: chunk.done,
  });

  return `event: chunk\ndata: ${payload}\n\n`;
}

function toWebsocketChunk(chunk: StreamChunk): string {
  return JSON.stringify({
    type: "chunk",
    index: chunk.index,
    delta: chunk.delta,
    cumulativeText: chunk.cumulativeText || "",
    done: chunk.done,
  });
}

function buildPlainText(chunks: StreamChunk[]): string {
  if (chunks.length === 0) {
    return "";
  }

  const bestCumulative = chooseBestCumulativeText(chunks);
  if (bestCumulative) {
    return bestCumulative;
  }

  return chunks.map((chunk) => sanitizeChunkPayload(chunk.delta || "")).join("");
}

export function streamChunkSerializer(
  input: StreamChunkSerializerInput,
): StreamChunkSerializerOutput {
  const mode = resolveMode(input.mode);
  const chunks = normalizeChunks(input.chunks);
  const lines: string[] = [];

  for (const chunk of chunks) {
    if (mode === "sse") {
      lines.push(toSseChunk(chunk));
      continue;
    }

    if (mode === "websocket") {
      lines.push(toWebsocketChunk(chunk));
      continue;
    }

    lines.push(chunk.delta);
  }

  const text =
    mode === "plain"
      ? buildPlainText(chunks)
      : mode === "sse"
        ? lines.join("")
        : lines.join("\n");

  return {
    ok: true,
    component: "stream-chunk-serializer",
    score: chunks.length > 0 ? 0.95 : 0.35,
    text,
    chunkCount: chunks.length,
  };
}
