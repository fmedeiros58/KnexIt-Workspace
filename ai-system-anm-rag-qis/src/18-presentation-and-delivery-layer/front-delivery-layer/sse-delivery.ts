/**
 * @file sse-delivery.ts
 * @description Monta payload SSE e garante evento terminal coerente com o texto final serializado.
 * @layer 18-presentation-and-delivery-layer
 * @purpose Evitar corte antecipado quando um stream reaproveitado contem done truncado.
 * @inputs Texto serializado, stream de chunks e politica de retry.
 * @outputs DeliveryBuildResult em formato SSE.
 * @dependsOn presentation-contracts, stream-chunk-serializer.
 * @usedBy presentation-front-bridge.
 * @invariants O ultimo evento done deve carregar o texto final completo conhecido pela camada 18.
 * @notes Se houver done divergente, um done corretivo e anexado sem reconstruir a descida.
 */
import type { DeliveryBuildResult } from "../presentation-contracts";
import type { StreamChunkSerializerOutput } from "../output-serializer/stream-chunk-serializer";

export interface SseDeliveryInput {
  serializedText: string;
  stream: StreamChunkSerializerOutput;
  retryPolicy: DeliveryBuildResult["retryPolicy"];
}

function normalizeLineEndings(value: string): string {
  return `${value || ""}`.replace(/\r\n?/g, "\n");
}

function stripLeadingRetryLines(value: string): string {
  return normalizeLineEndings(value)
    .replace(/^(?:retry:\s*\d+\s*\n)+/i, "")
    .trim();
}

function buildDoneEvent(text: string): string {
  return `event: done\ndata: ${JSON.stringify({ done: true, text })}\n\n`;
}

function buildSingleChunkEvent(text: string): string {
  return `event: chunk\ndata: ${JSON.stringify({
    index: 0,
    delta: text,
    cumulativeText: text,
    done: false,
  })}\n\n`;
}

function hasDoneEvent(value: string): boolean {
  return /(?:^|\n)event:\s*done\s*\n/i.test(normalizeLineEndings(value));
}

function extractDoneEventTexts(value: string): string[] {
  const normalized = normalizeLineEndings(value);
  const matches = normalized.matchAll(/event:\s*done\s*\ndata:\s*(.+?)(?:\n\n|$)/gis);
  const texts: string[] = [];
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1].trim()) as { text?: unknown };
      texts.push(typeof parsed.text === "string" ? parsed.text : "");
    } catch {
      texts.push("");
    }
  }
  return texts;
}

function normalizedComparableText(value: string): string {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function needsCorrectiveDoneEvent(streamText: string, serializedText: string): boolean {
  const doneTexts = extractDoneEventTexts(streamText);
  if (!doneTexts.length) return false;
  const finalDoneText = normalizedComparableText(doneTexts[doneTexts.length - 1] || "");
  const expectedText = normalizedComparableText(serializedText);
  return Boolean(expectedText && finalDoneText !== expectedText);
}

function ensureTerminalDoneEvent(streamText: string, serializedText: string): string {
  const normalized = stripLeadingRetryLines(streamText);

  if (!normalized) {
    if (!serializedText) {
      return buildDoneEvent("");
    }

    return `${buildSingleChunkEvent(serializedText)}${buildDoneEvent(serializedText)}`;
  }

  if (hasDoneEvent(normalized)) {
    const body = normalized.endsWith("\n\n") ? normalized : `${normalized}\n\n`;
    return needsCorrectiveDoneEvent(body, serializedText)
      ? `${body}${buildDoneEvent(serializedText)}`
      : body;
  }

  const safeText = `${serializedText || ""}`;
  const body = normalized.endsWith("\n\n") ? normalized : `${normalized}\n\n`;
  return `${body}${buildDoneEvent(safeText)}`;
}

export function sseDelivery(input: SseDeliveryInput): DeliveryBuildResult {
  const serializedText = `${input.serializedText || ""}`;
  const streamBody = ensureTerminalDoneEvent(input.stream.text || "", serializedText);
  const text = `retry: ${input.retryPolicy.baseBackoffMs}\n${streamBody}`;

  return {
    channel: "sse",
    format: "plain-text",
    text,
    payload: {
      mode: "sse",
      text: serializedText,
      streamChunkCount: input.stream.chunkCount,
      retry: input.retryPolicy.baseBackoffMs,
      hasTerminalDoneEvent: true,
    },
    retryPolicy: input.retryPolicy,
  };
}

