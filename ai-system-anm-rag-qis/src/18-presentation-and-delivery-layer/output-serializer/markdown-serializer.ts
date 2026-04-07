import type { PresentationRenderModel, SerializedPresentation } from "../presentation-contracts";
import { formatAbntReferenceList } from "../textual-layout-engine/abnt-reference-list-formatter";
import { applyHeadingAndListStrategy } from "../textual-layout-engine/heading-list-strategy";

export interface MarkdownSerializerInput {
  model: PresentationRenderModel;
}

export interface MarkdownSerializerOutput extends SerializedPresentation {
  format: "markdown";
}

function normalizeSpacing(text: string) {
  return `${text || ""}`
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatAbntReferenceSection(model: PresentationRenderModel) {
  const references = [
    ...formatAbntReferenceList(model.referenceEntries, { markdown: true }),
    ...(model.referenceList || []),
  ].filter(Boolean);
  const deduped = [...new Set(references)];
  if (!deduped.length) return "";
  return ["### Referencias", ...deduped].join("\n\n");
}

function formatDefaultReferenceSection(model: PresentationRenderModel) {
  if (!model.citations.length) return "";
  const lines = ["### Fontes"];
  for (const citation of model.citations.slice(0, 8)) {
    lines.push(`- [${citation.title || "fonte"}](${citation.url})`);
  }
  return lines.join("\n");
}

export function markdownSerializer(input: MarkdownSerializerInput): MarkdownSerializerOutput {
  const model = input.model;
  const sections: string[] = [];
  const coreText = model.responseLayoutPlan
    ? applyHeadingAndListStrategy(model.bubble.text.trim(), model.responseLayoutPlan)
    : model.bubble.text.trim();
  if (coreText) sections.push(normalizeSpacing(coreText));

  for (const block of model.codeBlocks) {
    sections.push(`\`\`\`${block.language}`, block.code, "\`\`\`");
  }

  const abntMode = model.citationRequestContext.referenceListStyle === "abnt";
  const references = abntMode && model.citationRequestContext.requestedReferenceList
    ? formatAbntReferenceSection(model)
    : formatDefaultReferenceSection(model);
  if (references) sections.push(references);

  const text = normalizeSpacing(sections.join("\n\n")).trim();
  return {
    format: "markdown",
    text,
    score: Math.max(0.48, Math.min(0.98, 0.7 + model.codeBlocks.length * 0.06)),
    rhetoricalShape: model.responseLayoutPlan?.rhetoricalShape,
    layoutNotes: model.responseLayoutPlan?.notes || [],
    textualAudit: model.textualAudit,
    payload: {
      markdown: text,
      citations: model.citations,
      codeBlocks: model.codeBlocks,
      confidence: model.confidence,
      referenceListStyle: model.citationRequestContext.referenceListStyle,
      citationStyle: model.citationRequestContext.citationStyle,
      responseLayoutPlan: model.responseLayoutPlan,
      textualAudit: model.textualAudit,
    },
  };
}
