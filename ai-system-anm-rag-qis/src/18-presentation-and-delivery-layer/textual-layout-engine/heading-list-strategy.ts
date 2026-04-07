import type { HeadingStrategy, ListStrategy, ResponseLayoutPlan } from "./response-layout-types";

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveHeadingStrategy(prompt: string, text: string): HeadingStrategy {
  const normalizedPrompt = normalize(prompt);
  const normalizedText = normalize(text);
  const headingHint = /\b(titulo|titulos|secoes|secao|topicos|subtitulo|subtitulos)\b/.test(normalizedPrompt);
  const denseAnalytical = normalizedText.length > 1200 || /\b(a|b|c|d|e|f|g)\)/.test(normalizedText);

  if (!denseAnalytical && !headingHint) return "none";
  if (denseAnalytical && headingHint) return "moderate";
  return "light";
}

export function resolveListStrategy(prompt: string, text: string): ListStrategy {
  const normalizedPrompt = normalize(prompt);
  const normalizedText = normalize(text);
  const explicitList = /\b(lista|liste|listar|em topicos|bullet|itens|numerado|enumerado)\b/.test(normalizedPrompt);
  const procedural = /\b(passo a passo|etapas|sequencia|ordem|procedimento)\b/.test(normalizedPrompt);
  const hasPseudoList = /(^|\n)\s*(?:[-*•]|\d+\.)\s+/m.test(text);
  const hasManyIndependentItems = (normalizedText.match(/(?:;|\n)/g) || []).length >= 4;

  if (procedural) return "preferred";
  if (explicitList) return "allowed";
  if (hasPseudoList && hasManyIndependentItems) return "minimal";
  return "avoid";
}

function splitListItems(text: string) {
  return `${text || ""}`
    .split(/\n/g)
    .map((line) => line.trim())
    .filter((line) => /^([-*•]|\d+\.)\s+/.test(line))
    .map((line) => line.replace(/^([-*•]|\d+\.)\s+/, "").trim())
    .filter(Boolean);
}

export function shouldKeepList(text: string, strategy: ListStrategy) {
  if (strategy === "preferred") return true;
  const listItems = splitListItems(text);
  if (listItems.length === 0) return false;
  if (strategy === "allowed") return listItems.length >= 2;
  if (strategy === "minimal") return listItems.length >= 3;
  return false;
}

export function convertPseudoListToProse(text: string) {
  const listItems = splitListItems(text);
  if (!listItems.length) return text;

  const prose = listItems
    .map((item, index) => {
      const suffix = index === listItems.length - 1 ? "." : ";";
      return `${item.replace(/[;,.]\s*$/g, "")}${suffix}`;
    })
    .join(" ");

  const nonListLines = `${text || ""}`
    .split(/\n/g)
    .map((line) => line.trim())
    .filter((line) => line && !/^([-*•]|\d+\.)\s+/.test(line));

  return [...nonListLines, prose].join("\n\n").trim();
}

export function normalizeHeadingUsage(text: string, strategy: HeadingStrategy) {
  if (strategy === "moderate") return text.trim();

  const lines = `${text || ""}`.split(/\n/g);
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/^#{1,6}\s+/.test(trimmed)) {
      return strategy === "light" && /^#{1,3}\s+/.test(trimmed);
    }
    return true;
  });
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function applyHeadingAndListStrategy(text: string, plan: ResponseLayoutPlan) {
  let output = `${text || ""}`.trim();
  if (!output) return output;

  output = normalizeHeadingUsage(output, plan.headingStrategy);
  if (!shouldKeepList(output, plan.listStrategy)) {
    output = convertPseudoListToProse(output);
  }
  return output.replace(/\n{3,}/g, "\n\n").trim();
}
