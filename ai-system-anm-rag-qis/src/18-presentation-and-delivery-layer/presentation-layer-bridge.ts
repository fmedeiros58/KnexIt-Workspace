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

function shouldApplyDialogicProgression(state: ProcessingState, text: string) {
  return (
    Boolean(state.communicativeElaborationState) &&
    text.length >= 80 &&
    state.executionPlan.selectedRoute !== "minimum" &&
    state.selectedMode !== "chat" &&
    !state.conversationState.needsClarification
  );
}

function shouldApplyEpistemicClarity(state: ProcessingState) {
  return state.epistemicAuditState.claimCount > 0 && state.executionPlan.selectedRoute !== "minimum";
}

function shouldApplyPhilosophicalConsistency(state: ProcessingState) {
  return Boolean(state.philosophicalSelfModelState) && !state.philosophicalSelfModelState?.consistencyOk;
}

function shouldForceConciseAnswer(state: ProcessingState) {
  return /\b(curta e grossa|curto e grosso|resposta curta|apenas responda|s[oó] diga|sem explicar|sem analisar|direto ao ponto)\b/i.test(
    `${state.normalizedMessage || state.rawMessage || ""}`,
  );
}

function normalizeTemporalQuery(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCurrentDateQuestion(value: string) {
  const normalized = normalizeTemporalQuery(value);
  if (!normalized) return false;

  const asksDate =
    /\b(que dia e hoje|qual o dia de hoje|qual dia e hoje|qual e a data de hoje|data de hoje|dia de hoje)\b/.test(normalized) ||
    (/\b(hoje)\b/.test(normalized) && /\b(que dia|qual dia|data)\b/.test(normalized));
  const asksTimeOnly = /\b(que horas sao|hora agora|horas agora|que horas e agora)\b/.test(normalized);
  return asksDate && !asksTimeOnly;
}

function capitalizeFirst(value: string) {
  if (!value) return value;
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function buildCurrentDateAnswer(timeZone = "America/Sao_Paulo") {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone }).format(now);
  const fullDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(now);
  return `Hoje é ${capitalizeFirst(weekday)}, ${fullDate}.`;
}

function normalizeParagraph(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isBoilerplateLeadParagraph(paragraph: string) {
  const normalized = normalizeParagraph(paragraph);
  if (!normalized) return true;
  return /^(considerando a pergunta|considerando a solicitacao|com base na pergunta|resposta:|leitura inicial:|em resumo,|em conclusao,)/i.test(
    normalized,
  );
}

function removeEchoAndBoilerplate(text: string) {
  const paragraphs = `${text || ""}`
    .split(/\n{2,}/g)
    .map((row) => row.trim())
    .filter(Boolean);

  while (paragraphs.length > 1 && isBoilerplateLeadParagraph(paragraphs[0])) {
    paragraphs.shift();
  }

  const deduped: string[] = [];
  for (const paragraph of paragraphs) {
    const normalized = normalizeParagraph(paragraph);
    const previous = deduped.length ? normalizeParagraph(deduped[deduped.length - 1]) : "";
    if (normalized && normalized === previous) continue;
    deduped.push(paragraph);
  }

  return deduped.join("\n\n").trim();
}

function applyPresentationPolish(state: ProcessingState, text: string) {
  let output = `${text || ""}`.trim();
  if (!output) return "";

  if (shouldApplyDialogicProgression(state, output)) {
    const opening = state.communicativeElaborationState?.coConstructionPlan.openingMove || "";
    if (opening && !output.toLowerCase().includes("leitura inicial")) {
      output = `${opening}\n\n${output}`;
    }
  }

  if (shouldApplyEpistemicClarity(state)) {
    const uncertainty = state.epistemicAuditState.uncertaintySignals.slice(0, 2).join("; ");
    if (uncertainty && !output.toLowerCase().includes("sinal epistemico")) {
      output = `${output}\n\nSinal epistemico: ${uncertainty}.`;
    }
  }

  if (shouldApplyPhilosophicalConsistency(state)) {
    const notes = state.philosophicalSelfModelState?.consistencyNotes.slice(0, 2).join("; ") || "";
    if (notes && !output.toLowerCase().includes("consistencia filosofica")) {
      output = `${output}\n\nConsistencia filosofica: ${notes}.`;
    }
  }

  let cleaned = removeEchoAndBoilerplate(output);
  if (!cleaned || /^fontes:/i.test(cleaned)) {
    cleaned = output;
  }
  cleaned = cleaned.replace(/^resposta:\s*/i, "").trim();

  if (shouldForceConciseAnswer(state)) {
    const withoutSources = cleaned.replace(/\n{1,}fontes:\s*[\s\S]*$/i, "").trim();
    const sentences = withoutSources.split(/(?<=[.!?])\s+/g).filter(Boolean);
    const concise = (sentences.length > 3 ? sentences.slice(0, 3).join(" ") : withoutSources).trim();
    if (concise) return concise;
  }

  return cleaned;
}

export async function runPresentationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const responseForDelivery = `${state.finalResponse || state.structuredResponse || state.humanizedResponse || ""}`.trim();
  const utf8Guard = ensureUtf8Response(responseForDelivery);
  const channel = resolveDeliveryChannel();
  const httpRetrievedSources = state.retrievedSources.filter((source) => isHttpUrl(source.url));

  const code = codeBlockAdapter({ text: utf8Guard.text });
  const bubble = chatBubbleAdapter({ text: code.cleanedText || utf8Guard.text });
  const citations = citationAdapter({ sources: httpRetrievedSources });
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
  const rawFinalText = `${front.delivery.text || selectedSerialized.text || bubble.bubble.text}`.trim();
  const forcedDateAnswer = isCurrentDateQuestion(state.normalizedMessage || state.rawMessage)
    ? buildCurrentDateAnswer()
    : null;
  const finalTextGuard = ensureUtf8Response(forcedDateAnswer || applyPresentationPolish(state, rawFinalText));
  const finalText = finalTextGuard.text;

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
      utf8Repaired: utf8Guard.repaired || finalTextGuard.repaired,
      dialogicProgressionApplied: shouldApplyDialogicProgression(state, rawFinalText),
      epistemicClarityApplied: shouldApplyEpistemicClarity(state),
      philosophicalConsistencyApplied: shouldApplyPhilosophicalConsistency(state),
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
        `utf8_repaired=${utf8Guard.repaired || finalTextGuard.repaired}; citations=${finalCitations.length}; stream_chunks=${stream.serialized.chunkCount}; recovered=${stream.recovered}; ` +
        `date_guard_applied=${forcedDateAnswer ? "true" : "false"}`,
    }),
  );

  return state;
}
