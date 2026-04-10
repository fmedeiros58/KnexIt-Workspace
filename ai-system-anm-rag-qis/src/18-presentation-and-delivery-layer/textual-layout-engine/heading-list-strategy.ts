import { ensureUtf8Response } from "../text-encoding-guard";
import type { HeadingStrategy, ListStrategy, ResponseLayoutPlan } from "./response-layout-types";

function collapseWhitespace(value: string): string {
  return `${value || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function sanitizeSurfaceText(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  return collapseWhitespace(stripDialogueLabels(utf8));
}

function extractCodeFences(text: string): { placeholdersText: string; fences: string[] } {
  const fences: string[] = [];
  const placeholdersText = `${text || ""}`.replace(/```[\s\S]*?```/g, (match) => {
    const index = fences.push(match) - 1;
    return `__CODE_FENCE_${index}__`;
  });

  return { placeholdersText, fences };
}

function restoreCodeFences(text: string, fences: string[]): string {
  let restored = `${text || ""}`;
  fences.forEach((fence, index) => {
    restored = restored.replace(`__CODE_FENCE_${index}__`, fence);
  });
  return restored;
}

function splitLines(text: string): string[] {
  return `${text || ""}`.split(/\n/g);
}

function isHeadingLine(line: string): boolean {
  return /^#{1,6}\s+\S/.test(`${line || ""}`.trim());
}

function isListLine(line: string): boolean {
  return /^([-*•]|\d+\.)\s+/.test(`${line || ""}`.trim());
}

function isStructuralLine(line: string): boolean {
  const trimmed = `${line || ""}`.trim();
  if (!trimmed) return false;

  return (
    isHeadingLine(trimmed) ||
    isListLine(trimmed) ||
    /^>/.test(trimmed) ||
    /^\|/.test(trimmed) ||
    /^__CODE_FENCE_\d+__$/.test(trimmed)
  );
}

function countPseudoListItems(text: string): number {
  return splitLines(text).filter((line) => isListLine(line)).length;
}

function hasDenseAnalyticalSurface(text: string): boolean {
  const normalizedText = normalize(text);
  const paragraphCount = `${text || ""}`.split(/\n{2,}/g).filter((row) => row.trim()).length;
  const pseudoListCount = countPseudoListItems(text);
  const headingCount = splitLines(text).filter((line) => isHeadingLine(line)).length;

  return (
    normalizedText.length > 1200 ||
    paragraphCount >= 4 ||
    pseudoListCount >= 3 ||
    headingCount >= 2 ||
    /\b(a|b|c|d|e|f|g)\)/.test(normalizedText)
  );
}

function hasExplicitHeadingHint(prompt: string): boolean {
  const normalizedPrompt = normalize(prompt);
  return /\b(titulo|titulos|secoes|secao|topicos|subtitulo|subtitulos|cabecalho|cabecalhos)\b/.test(normalizedPrompt);
}

function hasExplicitListHint(prompt: string): boolean {
  const normalizedPrompt = normalize(prompt);
  return /\b(lista|liste|listar|em topicos|bullet|itens|numerado|enumerado)\b/.test(normalizedPrompt);
}

function hasProceduralHint(prompt: string): boolean {
  const normalizedPrompt = normalize(prompt);
  return /\b(passo a passo|etapas|sequencia|ordem|procedimento|roteiro)\b/.test(normalizedPrompt);
}

export function resolveHeadingStrategy(prompt: string, text: string): HeadingStrategy {
  const cleanedPrompt = sanitizeSurfaceText(prompt);
  const cleanedText = sanitizeSurfaceText(text);

  const headingHint = hasExplicitHeadingHint(cleanedPrompt);
  const denseAnalytical = hasDenseAnalyticalSurface(cleanedText);
  const alreadyHasHeadings = splitLines(cleanedText).some((line) => isHeadingLine(line));

  if (!denseAnalytical && !headingHint && !alreadyHasHeadings) return "none";
  if (denseAnalytical && (headingHint || alreadyHasHeadings)) return "moderate";
  return "light";
}

export function resolveListStrategy(prompt: string, text: string): ListStrategy {
  const cleanedPrompt = sanitizeSurfaceText(prompt);
  const cleanedText = sanitizeSurfaceText(text);

  const explicitList = hasExplicitListHint(cleanedPrompt);
  const procedural = hasProceduralHint(cleanedPrompt);
  const hasPseudoList = /(^|\n)\s*(?:[-*•]|\d+\.)\s+/m.test(cleanedText);
  const hasManyIndependentItems =
    (normalize(cleanedText).match(/(?:;|\n)/g) || []).length >= 4 ||
    countPseudoListItems(cleanedText) >= 3;

  if (procedural) return "preferred";
  if (explicitList) return "allowed";
  if (hasPseudoList && hasManyIndependentItems) return "minimal";
  return "avoid";
}

function splitListItems(text: string) {
  return splitLines(text)
    .map((line) => line.trim())
    .filter((line) => isListLine(line))
    .map((line) => line.replace(/^([-*•]|\d+\.)\s+/, "").trim())
    .filter(Boolean);
}

export function shouldKeepList(text: string, strategy: ListStrategy) {
  const cleaned = sanitizeSurfaceText(text);

  if (strategy === "preferred") return countPseudoListItems(cleaned) >= 1;

  const listItems = splitListItems(cleaned);
  if (listItems.length === 0) return false;
  if (strategy === "allowed") return listItems.length >= 2;
  if (strategy === "minimal") return listItems.length >= 3;
  return false;
}

function joinListItemsAsProse(items: string[]): string {
  return items
    .map((item, index) => {
      const cleaned = sanitizeSurfaceText(item).replace(/[;,.]\s*$/g, "");
      const suffix = index === items.length - 1 ? "." : ";";
      return `${cleaned}${suffix}`;
    })
    .join(" ");
}

export function convertPseudoListToProse(text: string) {
  const cleaned = sanitizeSurfaceText(text);
  const { placeholdersText, fences } = extractCodeFences(cleaned);

  const lines = splitLines(placeholdersText);
  const listItems = lines
    .map((line) => line.trim())
    .filter((line) => isListLine(line))
    .map((line) => line.replace(/^([-*•]|\d+\.)\s+/, "").trim())
    .filter(Boolean);

  if (!listItems.length) return cleaned;

  const prose = joinListItemsAsProse(listItems);

  const nonListLines = lines
    .map((line) => line.trim())
    .filter((line) => line && !isListLine(line));

  const rebuilt = collapseWhitespace(
    [...nonListLines, prose].join("\n\n"),
  );

  return restoreCodeFences(rebuilt, fences).trim();
}

export function normalizeHeadingUsage(text: string, strategy: HeadingStrategy) {
  const cleaned = sanitizeSurfaceText(text);
  const { placeholdersText, fences } = extractCodeFences(cleaned);

  if (strategy === "moderate") {
    return restoreCodeFences(placeholdersText.trim(), fences);
  }

  const lines = splitLines(placeholdersText);
  const cleanedLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;

    if (isHeadingLine(trimmed)) {
      return strategy === "light" && /^#{1,3}\s+/.test(trimmed);
    }

    return true;
  });

  const rebuilt = cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return restoreCodeFences(rebuilt, fences);
}

function dedupeConsecutiveParagraphs(text: string): string {
  const paragraphs = `${text || ""}`
    .split(/\n{2,}/g)
    .map((paragraph) => sanitizeSurfaceText(paragraph))
    .filter(Boolean);

  if (paragraphs.length <= 1) return `${text || ""}`.trim();

  const result: string[] = [];
  for (const paragraph of paragraphs) {
    const previous = result[result.length - 1];
    if (previous && normalize(previous) === normalize(paragraph)) {
      continue;
    }
    result.push(paragraph);
  }

  return result.join("\n\n").trim();
}

export function applyHeadingAndListStrategy(text: string, plan: ResponseLayoutPlan) {
  let output = sanitizeSurfaceText(text);
  if (!output) return output;

  output = normalizeHeadingUsage(output, plan.headingStrategy);

  if (!shouldKeepList(output, plan.listStrategy)) {
    output = convertPseudoListToProse(output);
  }

  output = dedupeConsecutiveParagraphs(output);
  return output.replace(/\n{3,}/g, "\n\n").trim();
}