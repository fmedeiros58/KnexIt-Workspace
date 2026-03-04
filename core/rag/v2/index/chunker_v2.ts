import { createHash } from "crypto";

export type PageTextV2 = {
  pageNumber: number;
  textRaw: string;
  textNorm: string;
  hasOcr: boolean;
  headingHint?: string | null;
};

export type ChunkV2 = {
  chunkIndex: number;
  text: string;
  pageStart: number;
  pageEnd: number;
  sectionPath: string;
  offsets: {
    pageNumber: number;
    charStart: number;
    charEnd: number;
  }[];
  hash: string;
  pipelineVersion: "v2";
};

export type ChunkerV2Input = {
  pages: PageTextV2[];
  chunkSizeChars: number;
  overlapChars: number;
  fallbackSectionPath?: string;
};

function normalizeText(value: string) {
  return `${value || ""}`
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectSectionPath(text: string, fallback: string) {
  const heading = text
    .split(/\n/g)
    .slice(0, 2)
    .map((line) => line.trim())
    .find((line) => line.length >= 5 && line.length <= 120);
  if (!heading) return fallback;
  return heading.slice(0, 120);
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export class ChunkerV2 {
  chunk(input: ChunkerV2Input): ChunkV2[] {
    const chunkSize = Math.max(400, Math.trunc(input.chunkSizeChars || 1400));
    const overlap = Math.max(0, Math.min(Math.trunc(input.overlapChars || 180), chunkSize - 1));
    const fallbackSectionPath = input.fallbackSectionPath || "Documento";
    const rows: ChunkV2[] = [];
    let chunkIndex = 0;

    for (const page of input.pages) {
      const textNorm = normalizeText(page.textNorm || page.textRaw);
      if (!textNorm) continue;
      const sectionPath = detectSectionPath(textNorm, page.headingHint || fallbackSectionPath);
      let start = 0;
      while (start < textNorm.length) {
        const hardEnd = Math.min(textNorm.length, start + chunkSize);
        let end = hardEnd;
        if (hardEnd < textNorm.length) {
          const softRangeStart = Math.max(start + Math.floor(chunkSize * 0.65), start + 1);
          for (let idx = hardEnd; idx >= softRangeStart; idx -= 1) {
            const char = textNorm[idx - 1];
            if (char === "\n" || char === "." || char === ";" || char === " ") {
              end = idx;
              break;
            }
          }
        }
        const chunkText = textNorm.slice(start, end).trim();
        if (chunkText) {
          rows.push({
            chunkIndex,
            text: chunkText,
            pageStart: page.pageNumber,
            pageEnd: page.pageNumber,
            sectionPath,
            offsets: [
              {
                pageNumber: page.pageNumber,
                charStart: start,
                charEnd: end,
              },
            ],
            hash: hashText(chunkText),
            pipelineVersion: "v2",
          });
          chunkIndex += 1;
        }
        if (end >= textNorm.length) break;
        start = Math.max(end - overlap, start + 1);
      }
    }
    return rows;
  }
}
