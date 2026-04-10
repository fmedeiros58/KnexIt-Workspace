import type { StreamChunk } from "../presentation-contracts";
import { ensureUtf8Response } from "../text-encoding-guard";

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

function resolveMode(
  value: StreamChunkSerializerInput["mode"],
): "plain" | "sse" | "websocket" {
  return value === "sse" || value === "websocket" ? value : "plain";
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

  const roleTailPattern = /\b(?:usu[aá]rio|usuario|user|assistente|assistant|let[ií]cia|leticia)\s*:\s*/i;
  const match = roleTailPattern.exec(source);
  if (!match || match.index <= 0) return source;

  const head = source.slice(0, match.index).trim();
  return head || source;
}

function sanitizeChunkText(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  const withoutLabels = stripDialogueLabels(utf8);
  const withoutTail = stripRoleTranscriptTail(withoutLabels);
  return collapseWhitespace(withoutTail);
}

function normalizeChunks(value: StreamChunk[] | undefined): StreamChunk[] {
  if (!Array.isArray(value) || value.length === 0) return [];

  const filtered = value.filter(
    (chunk) =>
      !!chunk &&
      Number.isFinite(chunk.index) &&
      typeof chunk.delta === "string" &&
      typeof chunk.done === "boolean",
  );

  const sanitized: StreamChunk[] = [];
  let lastNormalizedDelta = "";
  let lastCumulative = "";

  for (const chunk of filtered) {
    const delta = sanitizeChunkText(chunk.delta || "");
    const cumulativeCandidate = sanitizeChunkText(chunk.cumulativeText || "");

    const normalizedDelta = normalizeForCompare(delta);
    const normalizedCumulative = normalizeForCompare(cumulativeCandidate);

    if (!delta && !cumulativeCandidate && !chunk.done) {
      continue;
    }

    if (normalizedDelta && normalizedDelta === lastNormalizedDelta && !chunk.done) {
      continue;
    }

    const cumulativeText =
      cumulativeCandidate ||
      collapseWhitespace(`${lastCumulative} ${delta}`.trim());

    sanitized.push({
      index: sanitized.length,
      delta,
      cumulativeText,
      done: Boolean(chunk.done),
    });

    lastNormalizedDelta = normalizedDelta;
    lastCumulative = cumulativeText;

    if (normalizedCumulative) {
      lastCumulative = cumulativeCandidate;
    }
  }

  if (sanitized.length > 0) {
    sanitized[sanitized.length - 1] = {
      ...sanitized[sanitized.length - 1],
      done: true,
    };
  }

  return sanitized;
}

function toSseChunk(chunk: StreamChunk): string {
  const payload = JSON.stringify({
    index: chunk.index,
    delta: chunk.delta,
    done: chunk.done,
  });

  return `event: chunk\ndata: ${payload}\n\n`;
}

function toWebsocketChunk(chunk: StreamChunk): string {
  return JSON.stringify({
    type: "chunk",
    index: chunk.index,
    delta: chunk.delta,
    done: chunk.done,
  });
}

function buildPlainText(chunks: StreamChunk[]): string {
  if (chunks.length === 0) return "";

  const lastChunk = chunks[chunks.length - 1];
  const finalFromCumulative = sanitizeChunkText(lastChunk.cumulativeText || "");
  if (finalFromCumulative) return finalFromCumulative;

  const joined = chunks.map((chunk) => sanitizeChunkText(chunk.delta || "")).filter(Boolean).join(" ");
  return collapseWhitespace(joined);
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
      : lines.join("\n");

  return {
    ok: true,
    component: "stream-chunk-serializer",
    score: chunks.length > 0 ? 0.9 : 0.35,
    text,
    chunkCount: chunks.length,
  };
}