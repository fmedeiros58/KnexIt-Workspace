import type { PresentationRenderModel, SerializedPresentation } from "../presentation-contracts";
import { ensureUtf8Response } from "../text-encoding-guard";
import { formatAbntReferenceList } from "../textual-layout-engine/abnt-reference-list-formatter";
import { applyHeadingAndListStrategy } from "../textual-layout-engine/heading-list-strategy";

export interface MarkdownSerializerInput {
  model: PresentationRenderModel;
}

export interface MarkdownSerializerOutput extends SerializedPresentation {
  format: "markdown";
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
    .map((paragraph) => collapseWhitespace(paragraph))
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

function sanitizeMarkdownText(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  const withoutLabels = stripDialogueLabels(utf8);
  const withoutTail = stripRoleTranscriptTail(withoutLabels);
  const deduped = dedupeConsecutiveParagraphs(withoutTail);
  return collapseWhitespace(deduped);
}

function normalizeSpacing(text: string) {
  return sanitizeMarkdownText(text);
}

function dedupeLines(lines: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const cleaned = collapseWhitespace(line);
    if (!cleaned) continue;

    const key = normalizeForCompare(cleaned);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    output.push(cleaned);
  }

  return output;
}

function formatAbntReferenceSection(model: PresentationRenderModel) {
  const references = dedupeLines([
    ...formatAbntReferenceList(model.referenceEntries, { markdown: true }),
    ...(model.referenceList || []),
  ]);

  if (!references.length) return "";
  return ["### Referências", ...references].join("\n\n");
}

function formatDefaultReferenceSection(model: PresentationRenderModel) {
  if (!model.citations.length) return "";

  const lines = ["### Fontes"];
  const seenUrls = new Set<string>();

  for (const citation of model.citations.slice(0, 8)) {
    const title = sanitizeMarkdownText(citation.title || "fonte");
    const url = `${citation.url || ""}`.trim();
    if (!url || seenUrls.has(url)) continue;

    seenUrls.add(url);
    lines.push(`- [${title}](${url})`);
  }

  return lines.length > 1 ? lines.join("\n") : "";
}

function hasStructuredMarkers(text: string): boolean {
  return (
    /(^|\n)\s*(?:[-*•]|\d+\.)\s+/.test(text) ||
    /^#{1,6}\s+/m.test(text) ||
    /\n\n/.test(text)
  );
}

function resolveCoreText(model: PresentationRenderModel): string {
  const bubbleText = sanitizeMarkdownText(model.bubble?.text || "");
  const modelText = sanitizeMarkdownText(model.text || "");
  const source = bubbleText || modelText;

  if (!source) return "";
  if (!model.responseLayoutPlan) return source;
  if (hasStructuredMarkers(source)) return source;

  return sanitizeMarkdownText(
    applyHeadingAndListStrategy(source, model.responseLayoutPlan),
  );
}

export function markdownSerializer(input: MarkdownSerializerInput): MarkdownSerializerOutput {
  const model = input.model;
  const sections: string[] = [];

  const coreText = resolveCoreText(model);
  if (coreText) sections.push(normalizeSpacing(coreText));

  for (const block of model.codeBlocks || []) {
    const language = `${block.language || ""}`.trim();
    const code = `${block.code || ""}`.replace(/\r\n?/g, "\n").trimEnd();
    if (!code) continue;

    sections.push(`\`\`\`${language}`, code, "\`\`\`");
  }

  const abntMode = model.citationRequestContext.referenceListStyle === "abnt";
  const references =
    abntMode && model.citationRequestContext.requestedReferenceList
      ? formatAbntReferenceSection(model)
      : formatDefaultReferenceSection(model);

  if (references) sections.push(references);

  const text = normalizeSpacing(sections.join("\n\n")).trim();

  return {
    format: "markdown",
    text,
    score: Math.max(0.48, Math.min(0.98, 0.7 + (model.codeBlocks?.length || 0) * 0.06)),
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
      longFormDiscourse: model.longFormDiscourse,
    },
  };
}