import { segmentText } from "./segmenter";
import { semanticDeduper } from "./semantic-deduper";
import { fragmentMerger } from "./fragment-merger";
import { discourseRebuilder } from "./discourse-rebuilder";
import { finalPolisher } from "./final-polisher";

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactParagraphs(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/g)
    .map((paragraph) => finalPolisher(paragraph))
    .filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const paragraph of paragraphs) {
    const key = normalizeKey(paragraph);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(paragraph);
  }

  return deduped.join("\n\n").trim();
}

export function enforceStructure(text: string): string {
  if (!text.trim()) return "";

  let segments = segmentText(text);
  segments = semanticDeduper(segments);
  segments = fragmentMerger(segments);

  return compactParagraphs(discourseRebuilder(segments));
}
