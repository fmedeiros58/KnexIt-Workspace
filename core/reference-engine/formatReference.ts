import type { BibliographicSource } from "./core/BibliographicSource";
import type { ReferenceStyle } from "./core/ReferenceStyle";
import { formatAbntReference } from "./formatters/abnt/formatAbntReference";
import { formatApa7Reference } from "./formatters/apa7/formatApa7Reference";

export function formatReference(source: BibliographicSource, style: ReferenceStyle): string {
  return style === "APA_7" ? formatApa7Reference(source) : formatAbntReference(source);
}

