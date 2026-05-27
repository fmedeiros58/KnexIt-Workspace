import type { BibliographicSource } from "./core/BibliographicSource";
import { parseBibtex } from "./input/parseBibtex";
import { parseDoi } from "./input/parseDoi";
import { parseIsbn } from "./input/parseIsbn";
import { parseManualInput } from "./input/parseManualInput";
import { parseRis } from "./input/parseRis";
import { parseUrlMetadata } from "./input/parseUrlMetadata";

export type ParseInputPayload =
  | { kind: "manual"; value: Partial<BibliographicSource> }
  | { kind: "doi"; value: string }
  | { kind: "isbn"; value: string }
  | { kind: "url"; value: string; metadata?: Partial<BibliographicSource> }
  | { kind: "bibtex"; value: string }
  | { kind: "ris"; value: string };

export function parseInput(payload: ParseInputPayload): BibliographicSource {
  switch (payload.kind) {
    case "doi":
      return parseDoi(payload.value);
    case "isbn":
      return parseIsbn(payload.value);
    case "url":
      return parseUrlMetadata(payload.value, payload.metadata);
    case "bibtex":
      return parseBibtex(payload.value);
    case "ris":
      return parseRis(payload.value);
    case "manual":
    default:
      return parseManualInput(payload.value);
  }
}

