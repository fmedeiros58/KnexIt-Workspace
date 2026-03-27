import type { VectorTopKResult } from "../database/vector-retrieval-repository";

export type ContextPackChunk = {
  chunkId: number;
  documentId: number;
  chunkIndex: number;
  distance: number;
  score: number;
  embeddingModel: string;
  sourceType: string;
  sourcePath: string;
  title: string | null;
  tokenCount: number | null;
  charStart: number;
  charEnd: number;
  text: string;
};

export type ContextPack = {
  text: string;
  chunks: ContextPackChunk[];
  totalCandidateChunks: number;
  omittedChunks: number;
  usedChars: number;
  maxChars: number;
  truncated: boolean;
};

export type ContextPackInput = {
  hits: VectorTopKResult[];
  maxChars: number;
  maxChunks: number;
};

function sanitizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeFold(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isInternalArtifactHit(hit: VectorTopKResult) {
  const sourcePath = normalizeFold(hit.sourcePath || "");
  const title = normalizeFold(hit.title || "");
  const text = normalizeFold(hit.text || "");
  if (sourcePath.includes("internal://rules")) return true;
  if (sourcePath.includes("internal-rules")) return true;
  if (title.includes("internal-rules")) return true;
  if (
    /\b(priorizar explicitude de incerteza quando aplicavel|evitar afirmacoes absolutas sem evidencia)\b/.test(text)
  ) {
    return true;
  }
  if (/\blegacy module\s*=|\blegacy-module\s*=|\bruntimescore\s*=/.test(text)) return true;
  if (/\b(perfil comportamental|sinal epistemic[oa]|consistencia filosofica)\b/.test(text)) return true;
  return false;
}

function stableSortHits(hits: VectorTopKResult[]) {
  return [...hits].sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (a.documentId !== b.documentId) return a.documentId - b.documentId;
    if (a.chunkIndex !== b.chunkIndex) return a.chunkIndex - b.chunkIndex;
    return a.chunkId - b.chunkId;
  });
}

function toContextChunk(hit: VectorTopKResult): ContextPackChunk {
  return {
    chunkId: hit.chunkId,
    documentId: hit.documentId,
    chunkIndex: hit.chunkIndex,
    distance: hit.distance,
    score: hit.score,
    embeddingModel: hit.embeddingModel,
    sourceType: hit.sourceType,
    sourcePath: hit.sourcePath,
    title: hit.title,
    tokenCount: hit.tokenCount,
    charStart: hit.charStart,
    charEnd: hit.charEnd,
    text: sanitizeText(hit.text),
  };
}

function buildChunkBlock(chunk: ContextPackChunk) {
  const header =
    `[chunk_id=${chunk.chunkId} document_id=${chunk.documentId} chunk_index=${chunk.chunkIndex} ` +
    `distance=${chunk.distance.toFixed(6)} score=${chunk.score.toFixed(6)}]`;
  return `${header}\n${chunk.text}`;
}

export function assembleContextPack(input: ContextPackInput): ContextPack {
  const maxChars = Math.max(256, Math.trunc(input.maxChars));
  const maxChunks = Math.max(1, Math.trunc(input.maxChunks));
  const sortedAll = stableSortHits(input.hits);
  const sorted = sortedAll.filter((hit) => !isInternalArtifactHit(hit));

  let usedChars = 0;
  const blocks: string[] = [];
  const chunks: ContextPackChunk[] = [];

  for (const hit of sorted) {
    if (chunks.length >= maxChunks) break;
    const chunk = toContextChunk(hit);
    if (!chunk.text) continue;
    const block = buildChunkBlock(chunk);
    const separatorLength = blocks.length ? 2 : 0;
    if (usedChars + separatorLength + block.length > maxChars) break;
    blocks.push(block);
    chunks.push(chunk);
    usedChars += separatorLength + block.length;
  }

  const omittedChunks = Math.max(0, sortedAll.length - chunks.length);
  return {
    text: blocks.join("\n\n"),
    chunks,
    totalCandidateChunks: sortedAll.length,
    omittedChunks,
    usedChars,
    maxChars,
    truncated: omittedChunks > 0,
  };
}
