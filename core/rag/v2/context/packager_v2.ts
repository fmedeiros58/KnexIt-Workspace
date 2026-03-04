import type { HybridHit } from "@/core/rag/v2/retrieval/hybrid_v2";

export type ContextPackV2Input = {
  question: string;
  hits: HybridHit[];
  maxContextChars: number;
  contextBudgetTokens: number;
  answerBudgetTokens: number;
  safetyMarginTokens: number;
  antiRedundancyThreshold?: number;
};

export type PackedEvidenceBlock = {
  docId: number;
  chunkId: number;
  pageStart: number | null;
  pageEnd: number | null;
  sectionPath: string | null;
  score: number;
  text: string;
};

export type ContextPackV2Result = {
  packedText: string;
  selected: PackedEvidenceBlock[];
  omitted: number;
  usedChars: number;
  budget: {
    contextBudgetTokens: number;
    answerBudgetTokens: number;
    safetyMarginTokens: number;
    maxContextChars: number;
  };
};

function normalizeText(value: string) {
  return `${value || ""}`
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 2);
}

function jaccard(a: string, b: string) {
  const aSet = new Set(tokenize(a));
  const bSet = new Set(tokenize(b));
  if (!aSet.size || !bSet.size) return 0;
  let intersect = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersect += 1;
  }
  const union = aSet.size + bSet.size - intersect;
  return union > 0 ? intersect / union : 0;
}

function toApproxTokens(chars: number) {
  return Math.max(0, Math.ceil(chars / 4));
}

function readPageRange(hit: HybridHit) {
  const metadata = (hit.metadata || {}) as Record<string, unknown>;
  const pageStartRaw = metadata.page_start ?? metadata.pageStart ?? metadata.page_number ?? null;
  const pageEndRaw = metadata.page_end ?? metadata.pageEnd ?? pageStartRaw;
  const pageStart = Number.isFinite(Number(pageStartRaw)) ? Math.max(1, Math.trunc(Number(pageStartRaw))) : null;
  const pageEnd = Number.isFinite(Number(pageEndRaw)) ? Math.max(1, Math.trunc(Number(pageEndRaw))) : pageStart;
  return { pageStart, pageEnd };
}

function readSectionPath(hit: HybridHit) {
  const metadata = (hit.metadata || {}) as Record<string, unknown>;
  const sectionPathRaw = metadata.section_path ?? metadata.sectionPath ?? metadata.heading_path ?? null;
  const sectionPath = typeof sectionPathRaw === "string" ? sectionPathRaw.trim() : "";
  return sectionPath || null;
}

function formatHeader(block: PackedEvidenceBlock) {
  const pages =
    block.pageStart && block.pageEnd
      ? block.pageStart === block.pageEnd
        ? `${block.pageStart}`
        : `${block.pageStart}-${block.pageEnd}`
      : "na";
  const section = block.sectionPath || "na";
  return `[DOC=${block.docId} CHUNK=${block.chunkId} PAGES=${pages} SECTION=${section} SCORE=${block.score.toFixed(4)}]`;
}

export class ContextPackagerV2 {
  pack(input: ContextPackV2Input): ContextPackV2Result {
    const maxCharsByTokens = Math.max(400, input.contextBudgetTokens * 4);
    const maxContextChars = Math.max(400, Math.min(input.maxContextChars, maxCharsByTokens));
    const antiRedundancyThreshold = Math.max(0.6, Math.min(input.antiRedundancyThreshold || 0.88, 0.99));
    const selected: PackedEvidenceBlock[] = [];
    const blocks: string[] = [];
    let usedChars = 0;

    for (const hit of input.hits) {
      const text = normalizeText(hit.text);
      if (!text) continue;
      let redundant = false;
      for (const picked of selected) {
        if (jaccard(picked.text, text) >= antiRedundancyThreshold) {
          redundant = true;
          break;
        }
      }
      if (redundant) continue;

      const { pageStart, pageEnd } = readPageRange(hit);
      const block: PackedEvidenceBlock = {
        docId: hit.documentId,
        chunkId: hit.chunkId,
        pageStart,
        pageEnd,
        sectionPath: readSectionPath(hit),
        score: hit.hybridScore,
        text,
      };
      const rendered = `${formatHeader(block)}\n${block.text}`;
      const separatorLen = blocks.length ? 2 : 0;
      if (usedChars + separatorLen + rendered.length > maxContextChars) break;
      blocks.push(rendered);
      selected.push(block);
      usedChars += separatorLen + rendered.length;
    }

    return {
      packedText: blocks.join("\n\n"),
      selected,
      omitted: Math.max(0, input.hits.length - selected.length),
      usedChars,
      budget: {
        contextBudgetTokens: Math.max(input.contextBudgetTokens, toApproxTokens(usedChars)),
        answerBudgetTokens: input.answerBudgetTokens,
        safetyMarginTokens: input.safetyMarginTokens,
        maxContextChars,
      },
    };
  }
}
