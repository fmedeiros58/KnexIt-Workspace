import { finalPolisher } from "./final-polisher";

export function polishFinalText(text: string): string {
  const compacted = text
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();

  const paragraphs = compacted
    .split(/\n{2,}/g)
    .map((paragraph) => finalPolisher(paragraph))
    .filter(Boolean);

  return paragraphs.join("\n\n").trim();
}
