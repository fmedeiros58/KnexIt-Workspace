import { useMemo, useState } from "react";
import { normalizePdfText } from "../utils";
import type { KnexPdfTextBlock as PdfTextBlock } from "../knex-pdf-engine";

export function usePdfSearch(blocks: PdfTextBlock[]) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const normalizedQuery = normalizePdfText(query).toLowerCase();
    if (!normalizedQuery) return [];

    return blocks
      .filter((block) =>
        normalizePdfText(block.text).toLowerCase().includes(normalizedQuery),
      )
      .map((block) => ({
        id: block.id,
        pageNumber: block.pageNumber,
        excerpt: block.text,
      }));
  }, [blocks, query]);

  return {
    query,
    setQuery,
    matches,
  };
}
