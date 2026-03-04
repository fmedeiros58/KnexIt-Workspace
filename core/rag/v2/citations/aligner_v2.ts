import type { PackedEvidenceBlock } from "@/core/rag/v2/context/packager_v2";

export type ClaimCitation = {
  claimId: string;
  claimText: string;
  docId: number;
  chunkId: number;
  pageStart: number | null;
  pageEnd: number | null;
  score: number;
};

export type CitationAlignmentResult = {
  citations: ClaimCitation[];
  uncoveredClaims: Array<{ claimId: string; claimText: string }>;
  annotatedAnswer: string;
};

function normalizeText(value: string) {
  return `${value || ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 2);
}

function overlapScore(claim: string, evidence: string) {
  const claimTokens = tokenize(claim);
  if (!claimTokens.length) return 0;
  const evidenceSet = new Set(tokenize(evidence));
  let overlap = 0;
  for (const token of claimTokens) {
    if (evidenceSet.has(token)) overlap += 1;
  }
  return overlap / claimTokens.length;
}

function splitClaims(answer: string) {
  const normalized = normalizeText(answer);
  if (!normalized) return [];
  const rawParts = normalized
    .split(/(?<=[.!?])\s+/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 24);
  return rawParts.slice(0, 24);
}

function citationLabel(citation: ClaimCitation) {
  if (!citation.pageStart) return `[doc ${citation.docId}]`;
  if (!citation.pageEnd || citation.pageEnd === citation.pageStart) {
    return `[doc ${citation.docId}, p.${citation.pageStart}]`;
  }
  return `[doc ${citation.docId}, p.${citation.pageStart}-${citation.pageEnd}]`;
}

export class CitationAlignerV2 {
  align(answer: string, evidenceBlocks: PackedEvidenceBlock[]): CitationAlignmentResult {
    const claims = splitClaims(answer);
    const citations: ClaimCitation[] = [];
    const uncoveredClaims: Array<{ claimId: string; claimText: string }> = [];

    for (let index = 0; index < claims.length; index += 1) {
      const claimText = claims[index];
      const claimId = `c${index + 1}`;
      let best: ClaimCitation | null = null;
      for (const block of evidenceBlocks) {
        const score = overlapScore(claimText, block.text);
        if (score < 0.18) continue;
        if (!best || score > best.score) {
          best = {
            claimId,
            claimText,
            docId: block.docId,
            chunkId: block.chunkId,
            pageStart: block.pageStart,
            pageEnd: block.pageEnd,
            score,
          };
        }
      }
      if (best) {
        citations.push(best);
      } else {
        uncoveredClaims.push({ claimId, claimText });
      }
    }

    const citationByClaim = new Map(citations.map((row) => [row.claimId, row]));
    const annotatedSentences = claims.map((claimText, index) => {
      const claimId = `c${index + 1}`;
      const citation = citationByClaim.get(claimId);
      if (!citation) return claimText;
      return `${claimText} ${citationLabel(citation)}`;
    });

    const annotatedAnswer = annotatedSentences.length ? annotatedSentences.join(" ") : answer.trim();
    return {
      citations,
      uncoveredClaims,
      annotatedAnswer,
    };
  }
}
