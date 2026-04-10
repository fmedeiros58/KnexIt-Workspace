export interface TokenStreamManagerInput {
  text: string;
}

export interface TokenStreamManagerOutput {
  ok: boolean;
  component: string;
  score: number;
  tokens: string[];
}

function normalizeInputText(value: string): string {
  return `${value || ""}`
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[ \u2000-\u200B\u202F\u205F\u3000]+/g, " ")
    .trim();
}

function isWhitespace(piece: string): boolean {
  return /^\s+$/.test(piece);
}

function isWordLike(piece: string): boolean {
  return /^[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*$/u.test(piece);
}

function isClosingPunctuation(piece: string): boolean {
  return /^[,.;:!?%)\]}"'»”’]+$/u.test(piece);
}

function isOpeningPunctuation(piece: string): boolean {
  return /^[([{'"«“‘]+$/u.test(piece);
}

function tokenizeRaw(text: string): string[] {
  return (
    text.match(
      /(?:[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*|[ \n]+|[^\s\p{L}\p{N}])/gu,
    ) || []
  );
}

function buildTokenStream(rawPieces: string[]): string[] {
  const tokens: string[] = [];
  let pendingWhitespace = "";

  for (const rawPiece of rawPieces) {
    const piece = `${rawPiece || ""}`;
    if (!piece) continue;

    if (isWhitespace(piece)) {
      pendingWhitespace = " ";
      continue;
    }

    const lastIndex = tokens.length - 1;
    const hasPrevious = lastIndex >= 0;

    if (isClosingPunctuation(piece) && hasPrevious) {
      tokens[lastIndex] = `${tokens[lastIndex]}${piece}${pendingWhitespace}`;
      pendingWhitespace = "";
      continue;
    }

    if (isOpeningPunctuation(piece)) {
      tokens.push(`${pendingWhitespace}${piece}`);
      pendingWhitespace = "";
      continue;
    }

    if (isWordLike(piece)) {
      tokens.push(`${piece}${pendingWhitespace}`);
      pendingWhitespace = "";
      continue;
    }

    if (hasPrevious) {
      tokens[lastIndex] = `${tokens[lastIndex]}${piece}${pendingWhitespace}`;
      pendingWhitespace = "";
      continue;
    }

    tokens.push(`${piece}${pendingWhitespace}`);
    pendingWhitespace = "";
  }

  if (pendingWhitespace && tokens.length > 0) {
    tokens[tokens.length - 1] = `${tokens[tokens.length - 1]}${pendingWhitespace}`;
  }

  return tokens
    .map((token) =>
      token.replace(/\s+/g, (match) => (match.includes("\n") ? " " : match)),
    )
    .filter(Boolean);
}

function estimateScore(tokens: string[], sourceText: string): number {
  if (!tokens.length) return 0.2;

  const reconstructed = tokens.join("");
  const sourceLen = sourceText.length || 1;
  const reconstructedLen = reconstructed.length || 1;

  const lengthSimilarity =
    1 - Math.min(1, Math.abs(sourceLen - reconstructedLen) / Math.max(sourceLen, 1));

  const avgTokenLength =
    tokens.reduce((sum, token) => sum + token.trim().length, 0) /
    Math.max(tokens.length, 1);

  const healthyDensity = avgTokenLength >= 2.5 && avgTokenLength <= 18 ? 1 : 0.75;

  const score = 0.52 + lengthSimilarity * 0.28 + healthyDensity * 0.16;
  return Math.max(0.1, Math.min(0.99, Number(score.toFixed(4))));
}

export function tokenStreamManager(
  input: TokenStreamManagerInput,
): TokenStreamManagerOutput {
  const text = normalizeInputText(input.text || "");
  const rawPieces = tokenizeRaw(text);
  const tokens = buildTokenStream(rawPieces);

  return {
    ok: true,
    component: "token-stream-manager",
    score: estimateScore(tokens, text),
    tokens,
  };
}