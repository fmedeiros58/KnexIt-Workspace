/**
 * @file websocket-delivery.ts
 * @description Monta payload WebSocket e garante mensagem terminal coerente com texto final.
 * @layer 18-presentation-and-delivery-layer
 * @purpose Evitar corte antecipado quando uma mensagem done reaproveitada esta truncada.
 * @inputs Texto serializado, stream de chunks e politica de retry.
 * @outputs DeliveryBuildResult em bloco JSON.
 * @dependsOn presentation-contracts, stream-chunk-serializer.
 * @usedBy presentation-front-bridge.
 * @invariants A ultima mensagem done deve carregar o texto final completo conhecido pela camada 18.
 * @notes Se houver done divergente, uma mensagem done corretiva e anexada ao fim.
 */
import type { DeliveryBuildResult } from "../presentation-contracts";
import type { StreamChunkSerializerOutput } from "../output-serializer/stream-chunk-serializer";

export interface WebsocketDeliveryInput {
  serializedText: string;
  stream: StreamChunkSerializerOutput;
  retryPolicy: DeliveryBuildResult["retryPolicy"];
}

type WebsocketMessage =
  | {
      type: "chunk";
      index: number;
      delta: string;
      cumulativeText?: string;
      done: boolean;
    }
  | {
      type: "done";
      text: string;
      done: true;
    };

function normalizeLineEndings(value: string): string {
  return `${value || ""}`.replace(/\r\n?/g, "\n");
}

function splitNonEmptyLines(value: string): string[] {
  return normalizeLineEndings(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function safeParseJsonLine(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function buildChunkMessage(text: string): string {
  const payload: WebsocketMessage = {
    type: "chunk",
    index: 0,
    delta: text,
    cumulativeText: text,
    done: false,
  };
  return JSON.stringify(payload);
}

function buildDoneMessage(text: string): string {
  const payload: WebsocketMessage = {
    type: "done",
    text,
    done: true,
  };
  return JSON.stringify(payload);
}

function isDoneMessage(line: string): boolean {
  const parsed = safeParseJsonLine(line);
  if (!parsed) {
    return false;
  }

  const type = parsed.type;
  const done = parsed.done;

  return type === "done" || done === true;
}

function extractDoneMessageTexts(lines: string[]): string[] {
  return lines.flatMap((line) => {
    const parsed = safeParseJsonLine(line);
    if (!parsed || !isDoneMessage(line)) return [];
    return typeof parsed.text === "string" ? [parsed.text] : [""];
  });
}

function normalizedComparableText(value: string): string {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function needsCorrectiveDoneMessage(lines: string[], serializedText: string): boolean {
  const doneTexts = extractDoneMessageTexts(lines);
  if (!doneTexts.length) return false;
  const finalDoneText = normalizedComparableText(doneTexts[doneTexts.length - 1] || "");
  const expectedText = normalizedComparableText(serializedText);
  return Boolean(expectedText && finalDoneText !== expectedText);
}

function ensureTerminalDoneMessage(streamText: string, serializedText: string): string {
  const lines = splitNonEmptyLines(streamText);

  if (lines.length === 0) {
    if (!serializedText) {
      return buildDoneMessage("");
    }

    return [buildChunkMessage(serializedText), buildDoneMessage(serializedText)].join("\n");
  }

  if (lines.some(isDoneMessage)) {
    return needsCorrectiveDoneMessage(lines, serializedText)
      ? [...lines, buildDoneMessage(serializedText)].join("\n")
      : lines.join("\n");
  }

  return [...lines, buildDoneMessage(serializedText)].join("\n");
}

export function websocketDelivery(input: WebsocketDeliveryInput): DeliveryBuildResult {
  const serializedText = `${input.serializedText || ""}`;
  const text = ensureTerminalDoneMessage(input.stream.text || "", serializedText);

  return {
    channel: "websocket",
    format: "json-block",
    text,
    payload: {
      mode: "websocket",
      format: "json-block",
      text: serializedText,
      streamChunkCount: input.stream.chunkCount,
      retryPolicy: input.retryPolicy,
      hasTerminalDoneMessage: true,
    },
    retryPolicy: input.retryPolicy,
  };
}

