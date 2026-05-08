/**
 * @file final-delivery-integrity-report-builder.ts
 * @description Constroi relatorio de integridade terminal para canais REST, SSE e WebSocket.
 * @layer 18-presentation-and-delivery-layer
 * @purpose Detectar divergencia entre texto semantico final e ultimo evento terminal entregue ao front-end.
 * @inputs Canal, texto semantico serializado e texto efetivamente entregue pelo canal.
 * @outputs FinalDeliveryIntegrityReport com hashes, contagens e issues.
 * @dependsOn final-delivery-integrity-report.
 * @usedBy presentation-front-bridge.
 * @invariants O ultimo terminal deve corresponder ao texto semantico quando o canal suporta evento done.
 * @notes Quando ha mais de um done e o ultimo bate com o texto semantico, isso indica correcao terminal provavelmente anexada.
 */
import type { FinalDeliveryIntegrityReport } from "../bridges/contracts/final-delivery-integrity-report";
import type { DeliveryChannel } from "../shared/enums/delivery-enums";

export interface FinalDeliveryIntegrityInput {
  channel: DeliveryChannel;
  semanticText: string;
  deliveryText: string;
}

function normalizeLineEndings(value: string): string {
  return `${value || ""}`.replace(/\r\n?/g, "\n");
}

function normalizeComparable(value: string): string {
  return normalizeLineEndings(value).replace(/\s+/g, " ").trim();
}

function stableHash(value: string): string {
  let hash = 2166136261;
  const source = normalizeComparable(value);

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function extractSseDoneTexts(value: string): string[] {
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

function extractWebsocketDoneTexts(value: string): string[] {
  return normalizeLineEndings(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as { type?: unknown; done?: unknown; text?: unknown };
        if (parsed.type !== "done" && parsed.done !== true) {
          return [];
        }
        return [typeof parsed.text === "string" ? parsed.text : ""];
      } catch {
        return [];
      }
    });
}

function resolveTerminalTexts(channel: DeliveryChannel, deliveryText: string): string[] {
  if (channel === "sse") {
    return extractSseDoneTexts(deliveryText);
  }

  if (channel === "websocket") {
    return extractWebsocketDoneTexts(deliveryText);
  }

  return [deliveryText];
}

export function buildFinalDeliveryIntegrityReport(
  input: FinalDeliveryIntegrityInput,
): FinalDeliveryIntegrityReport {
  const semanticText = normalizeComparable(input.semanticText);
  const terminalTexts = resolveTerminalTexts(input.channel, input.deliveryText);
  const terminalText = normalizeComparable(terminalTexts[terminalTexts.length - 1] || "");
  const terminalMatchesSemanticText = semanticText === terminalText;
  const terminalTextShorterThanSemantic = terminalText.length < semanticText.length;
  const correctiveTerminalLikelyAppended =
    terminalTexts.length > 1 &&
    terminalMatchesSemanticText &&
    normalizeComparable(terminalTexts[terminalTexts.length - 2] || "") !== semanticText;

  const issues: string[] = [];
  if (!terminalTexts.length) {
    issues.push("terminal_done_missing");
  }
  if (!terminalMatchesSemanticText) {
    issues.push("terminal_text_mismatch");
  }
  if (terminalTextShorterThanSemantic) {
    issues.push("terminal_text_shorter_than_semantic");
  }
  if (correctiveTerminalLikelyAppended) {
    issues.push("corrective_terminal_appended");
  }

  return {
    channel: input.channel,
    semanticTextHash: stableHash(semanticText),
    terminalTextHash: stableHash(terminalText),
    semanticCharCount: semanticText.length,
    terminalCharCount: terminalText.length,
    doneEventCount: terminalTexts.length,
    terminalMatchesSemanticText,
    terminalTextShorterThanSemantic,
    correctiveTerminalLikelyAppended,
    issues,
  };
}

