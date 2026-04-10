import type { PresentationRenderModel, SerializedPresentation } from "../presentation-contracts";
import { ensureUtf8Response } from "../text-encoding-guard";
import { formatAbntReferenceList } from "../textual-layout-engine/abnt-reference-list-formatter";
import { applyHeadingAndListStrategy } from "../textual-layout-engine/heading-list-strategy";

export interface PlainTextSerializerInput {
  model: PresentationRenderModel;
  includeCitations?: boolean;
}

export interface PlainTextSerializerOutput extends SerializedPresentation {
  format: "plain-text";
}

function collapseWhitespace(text: string) {
  return `${text || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeForCompare(value: string) {
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

function splitParagraphs(text: string): string[] {
  return `${text || ""}`
    .split(/\n{2,}/g)
    .map((row) => collapseWhitespace(row))
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

function sanitizePlainText(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  const withoutLabels = stripDialogueLabels(utf8);
  const withoutTail = stripRoleTranscriptTail(withoutLabels);
  const deduped = dedupeConsecutiveParagraphs(withoutTail);
  return collapseWhitespace(deduped);
}

function normalizeParagraphSpacing(text: string) {
  return sanitizePlainText(text);
}

function formatDefaultCitations(model: PresentationRenderModel) {
  const lines: string[] = [];
  if (model.citations.length > 0) {
    lines.push("Fontes:");
    for (const citation of model.citations.slice(0, 6)) {
      const title = sanitizePlainText(citation.title || "fonte");
      const url = `${citation.url || ""}`.trim();
      if (!url) continue;
      lines.push(`- ${title}: ${url}`);
    }
  }
  return lines;
}

function formatAbntReferences(model: PresentationRenderModel) {
  const fromEntries = formatAbntReferenceList(model.referenceEntries, { markdown: false });
  const fromAdapter = (model.referenceList || []).filter(Boolean);
  const combined = [...new Set([...fromEntries, ...fromAdapter])]
    .map((item) => sanitizePlainText(item))
    .filter(Boolean);

  if (!combined.length) return [];
  return ["Referências", ...combined];
}

function hasStructuredMarkers(text: string): boolean {
  return (
    /(^|\n)\s*(?:[-*•]|\d+\.)\s+/.test(text) ||
    /\b(?:conclusao|conclusão|passo|etapa|modelo|alternativa|cenario|cenário)\s+\d*\s*:/i.test(text) ||
    /\n\n/.test(text)
  );
}

function resolveBaseText(model: PresentationRenderModel): string {
  const bubbleText = sanitizePlainText(model.bubble?.text || "");
  const modelText = sanitizePlainText(model.text || "");

  const source = bubbleText || modelText;
  if (!source) return "";

  if (!model.responseLayoutPlan) return source;
  if (hasStructuredMarkers(source)) return source;

  return sanitizePlainText(
    applyHeadingAndListStrategy(source, model.responseLayoutPlan),
  );
}

export function plainTextSerializer(input: PlainTextSerializerInput): PlainTextSerializerOutput {
  const model = input.model;
  const lines: string[] = [];

  const baseText = resolveBaseText(model);
  if (baseText) lines.push(normalizeParagraphSpacing(baseText));

  const abntMode = model.citationRequestContext.referenceListStyle === "abnt";

  if (input.includeCitations !== false) {
    if (abntMode && model.citationRequestContext.requestedReferenceList) {
      const references = formatAbntReferences(model);
      if (references.length) lines.push("", ...references);
    } else {
      const references = formatDefaultCitations(model);
      if (references.length) lines.push("", ...references);
    }
  }

  const text = normalizeParagraphSpacing(lines.join("\n")).trim();

  return {
    format: "plain-text",
    text,
    score: Math.max(0.5, Math.min(0.99, 0.72 + (model.citations.length ? 0.12 : 0))),
    rhetoricalShape: model.responseLayoutPlan?.rhetoricalShape,
    layoutNotes: model.responseLayoutPlan?.notes || [],
    textualAudit: model.textualAudit,
    payload: {
      text,
      citations: model.citations,
      confidence: model.confidence,
      referenceList: abntMode ? formatAbntReferences(model).slice(1) : undefined,
      citationStyle: model.citationRequestContext.citationStyle,
      referenceListStyle: model.citationRequestContext.referenceListStyle,
      responseLayoutPlan: model.responseLayoutPlan,
      textualAudit: model.textualAudit,
      longFormDiscourse: model.longFormDiscourse,
    },
  };
}