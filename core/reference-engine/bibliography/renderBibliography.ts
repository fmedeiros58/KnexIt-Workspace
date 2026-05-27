import type { BibliographicSource } from "../core/BibliographicSource";
import type { ReferenceStyle } from "../core/ReferenceStyle";
import { formatReference } from "../formatReference";
import { sortBibliography } from "./sortBibliography";

export function renderBibliography(references: BibliographicSource[], style: ReferenceStyle): string[] {
  const sorted = sortBibliography(references, style);
  return sorted.map((source) => formatReference(source, style));
}
