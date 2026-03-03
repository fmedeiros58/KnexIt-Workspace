export type ChunkingInput = {
  text: string;
  chunkSizeChars: number;
  chunkOverlapChars: number;
  maxChunksPerDocument: number;
};

export type TextChunk = {
  chunkIndex: number;
  text: string;
  tokenCount: number | null;
  charStart: number;
  charEnd: number;
};

function countApproxTokens(text: string) {
  const terms = text.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return null;
  return terms.length;
}

function normalizeText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\u0000/g, "");
}

function findSplitPoint(text: string, start: number, hardEnd: number) {
  if (hardEnd >= text.length) return text.length;
  const minSoftEnd = start + Math.floor((hardEnd - start) * 0.65);
  for (let idx = hardEnd; idx > minSoftEnd; idx -= 1) {
    const char = text[idx - 1];
    if (char === "\n") return idx;
  }
  for (let idx = hardEnd; idx > minSoftEnd; idx -= 1) {
    const char = text[idx - 1];
    if (/\s/.test(char)) return idx;
  }
  return hardEnd;
}

function trimChunkBounds(text: string, start: number, end: number) {
  let left = start;
  let right = end;
  while (left < right && /\s/.test(text[left])) left += 1;
  while (right > left && /\s/.test(text[right - 1])) right -= 1;
  return { left, right };
}

export function chunkTextDeterministic(input: ChunkingInput): TextChunk[] {
  const normalizedText = normalizeText(input.text);
  const chunkSizeChars = Math.max(128, Math.trunc(input.chunkSizeChars));
  const chunkOverlapChars = Math.min(Math.max(0, Math.trunc(input.chunkOverlapChars)), chunkSizeChars - 1);
  const maxChunks = Math.max(1, Math.trunc(input.maxChunksPerDocument));
  const chunks: TextChunk[] = [];

  if (!normalizedText.trim()) return chunks;

  let start = 0;
  const stride = Math.max(1, chunkSizeChars - chunkOverlapChars);

  while (start < normalizedText.length) {
    if (chunks.length >= maxChunks) {
      throw new Error(`Limite de chunks excedido: max=${maxChunks}. Ajuste chunk size/overlap.`);
    }

    const hardEnd = Math.min(normalizedText.length, start + chunkSizeChars);
    const splitEnd = findSplitPoint(normalizedText, start, hardEnd);
    const end = splitEnd > start ? splitEnd : hardEnd;
    const bounds = trimChunkBounds(normalizedText, start, end);
    if (bounds.right > bounds.left) {
      const text = normalizedText.slice(bounds.left, bounds.right);
      chunks.push({
        chunkIndex: chunks.length,
        text,
        tokenCount: countApproxTokens(text),
        charStart: bounds.left,
        charEnd: bounds.right,
      });
    }

    if (end >= normalizedText.length) break;
    start = Math.max(start + stride, end - chunkOverlapChars);
  }

  return chunks;
}

