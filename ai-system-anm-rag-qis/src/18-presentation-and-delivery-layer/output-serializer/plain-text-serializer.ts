import type { PresentationRenderModel, SerializedPresentation } from "../presentation-contracts";
import { formatAbntReferenceList } from "../textual-layout-engine/abnt-reference-list-formatter";
import { applyHeadingAndListStrategy } from "../textual-layout-engine/heading-list-strategy";

export interface PlainTextSerializerInput {
  model: PresentationRenderModel;
  includeCitations?: boolean;
}

export interface PlainTextSerializerOutput extends SerializedPresentation {
  format: "plain-text";
}

function normalizeParagraphSpacing(text: string) {
  return `${text || ""}`
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDefaultCitations(model: PresentationRenderModel) {
  const lines: string[] = [];
  if (model.citations.length > 0) {
    lines.push("Fontes:");
    for (const citation of model.citations.slice(0, 6)) {
      const title = citation.title || "fonte";
      lines.push(`- ${title}: ${citation.url}`);
    }
  }
  return lines;
}

function formatAbntReferences(model: PresentationRenderModel) {
  const fromEntries = formatAbntReferenceList(model.referenceEntries, { markdown: false });
  const fromAdapter = (model.referenceList || []).filter(Boolean);
  const combined = [...new Set([...fromEntries, ...fromAdapter])].filter(Boolean);
  if (!combined.length) return [];
  return ["Referencias", ...combined];
}

export function plainTextSerializer(input: PlainTextSerializerInput): PlainTextSerializerOutput {
  const model = input.model;
  const lines: string[] = [];
  const bubble = input.model.bubble;
  const baseText = model.responseLayoutPlan
    ? applyHeadingAndListStrategy(bubble.text.trim(), model.responseLayoutPlan)
    : bubble.text.trim();
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
    },
  };
}
