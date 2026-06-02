import type { BibliographicSource } from "./core/BibliographicSource";

export function enrichReference(source: BibliographicSource): BibliographicSource {
  // Hook de enriquecimento externo (Crossref/DataCite/ISBNdb) pode ser conectado aqui.
  return source;
}

