import { ensureUtf8Response } from "../text-encoding-guard";
import type { ResponseLayoutPlan } from "../textual-layout-engine/response-layout-types";

export interface SentenceBufferingInput {
  tokens: string[];
  maxTokensPerSentence?: number;
  layoutPlan?: ResponseLayoutPlan;
}

export interface SentenceBufferingOutput {
  ok: boolean;
  component: string;
  score: number;
  sentences: string[];
}

const CONTINUITY_TAIL = [
  "alem disso",
  "além disso",
  "nesse sentido",
  "por isso",
  "assim",
  "ou seja",
  "em outras palavras",
  "desse modo",
  "logo",
  "portanto",
  "contudo",
  "todavia",
  "entretanto",
  "por outro lado",
  "primeiro",
  "segundo",
  "terceiro",
];

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function sanitizeSentenceText(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  return collapseWhitespace(stripDialogueLabels(utf8));
}

function endsWithContinuityCue(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  return CONTINUITY_TAIL.some((cue) => normalized.endsWith(cue));
}

function cleanupSpacing(text: string): string {
  return `${text || ""}`
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([(\[{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .trim();
}

function joinTokens(tokens: string[]): string {
  return sanitizeSentenceText(cleanupSpacing((tokens || []).join("")));
}

function endsWithStrongSentencePunctuation(text: string): boolean {
  return /[.!?]["')\]]?\s*$/.test(`${text || ""}`);
}

function endsWithSoftBoundary(text: string): boolean {
  return /[;:]["')\]]?\s*$/.test(`${text || ""}`);
}

function countUnescapedQuoteLike(text: string, quote: string): number {
  const source = `${text || ""}`;
  let total = 0;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    if (current !== quote) continue;

    const previous = source[index - 1] || "";
    const next = source[index + 1] || "";

    if (quote === "'" && /[a-zA-Z\u00C0-\u017F]/.test(previous) && /[a-zA-Z\u00C0-\u017F]/.test(next)) {
      continue;
    }

    total += 1;
  }

  return total;
}

function hasBalancedDelimiters(text: string): boolean {
  const raw = `${text || ""}`;
  let round = 0;
  let square = 0;
  let curly = 0;

  for (const char of raw) {
    if (char === "(") round += 1;
    else if (char === ")") round -= 1;
    else if (char === "[") square += 1;
    else if (char === "]") square -= 1;
    else if (char === "{") curly += 1;
    else if (char === "}") curly -= 1;

    if (round < 0 || square < 0 || curly < 0) return false;
  }

  const doubleQuotes = countUnescapedQuoteLike(raw, `"`);
  const singleQuotes = countUnescapedQuoteLike(raw, `'`);

  return round === 0 && square === 0 && curly === 0 && doubleQuotes % 2 === 0 && singleQuotes % 2 === 0;
}

function likelyPrematureSplit(text: string): boolean {
  const normalized = sanitizeSentenceText(cleanupSpacing(text));
  if (!normalized) return true;
  if (normalized.length <= 30 && !endsWithStrongSentencePunctuation(normalized)) return true;
  if (!hasBalancedDelimiters(normalized)) return true;
  if (/[,:;]\s*$/.test(normalized) && !endsWithStrongSentencePunctuation(normalized)) return true;

  if (
    /(?:\b(e|mas|ou|que|quando|enquanto|porque|pois|portanto|entretanto|contudo|todavia|logo)\s*)$/i.test(
      normalized,
    )
  ) {
    return true;
  }

  if (endsWithContinuityCue(normalized)) return true;
  return false;
}

function likelyIncompleteTail(text: string): boolean {
  const normalized = sanitizeSentenceText(cleanupSpacing(text));
  if (!normalized) return false;
  if (normalized.length < 24 && !endsWithStrongSentencePunctuation(normalized)) return true;
  if (!hasBalancedDelimiters(normalized)) return true;
  if (/[,:;]\s*$/.test(normalized)) return true;

  if (
    /(?:\b(de|da|do|das|dos|e|mas|ou|que|quando|porque|pois|com|para|por|em|sem|sob|entre)\s*)$/i.test(
      normalized,
    )
  ) {
    return true;
  }

  if (endsWithContinuityCue(normalized)) return true;
  return false;
}

function resolveMaxTokensPerSentence(input: SentenceBufferingInput): number {
  const complexity = `${input.layoutPlan?.complexity || ""}`.trim().toLowerCase();

  const layoutAwareMax = input.layoutPlan
    ? Math.max(
        complexity === "deep" ? 56 : complexity === "long" ? 52 : 28,
        input.layoutPlan.targetParagraphSentenceRange[1] * 24 +
          (input.layoutPlan.keepDenseParagraphs ? 16 : 0),
      )
    : 56;

  return Number.isFinite(input.maxTokensPerSentence)
    ? Math.max(12, Math.trunc(input.maxTokensPerSentence as number))
    : layoutAwareMax;
}

function minTokensBeforeSplit(
  maxTokensPerSentence: number,
  layoutPlan?: ResponseLayoutPlan,
): number {
  const densityBonus = layoutPlan?.keepDenseParagraphs ? 5 : 0;
  const complexity = `${layoutPlan?.complexity || ""}`.trim().toLowerCase();
  const deepBonus = complexity === "deep" || complexity === "long" ? 4 : 0;
  return Math.max(16, Math.floor(maxTokensPerSentence * 0.64) + densityBonus + deepBonus);
}

function shouldFlushByLimit(
  joined: string,
  bufferLength: number,
  maxTokensPerSentence: number,
  layoutPlan?: ResponseLayoutPlan,
): boolean {
  if (bufferLength < maxTokensPerSentence) return false;

  const minBeforeSplit = minTokensBeforeSplit(maxTokensPerSentence, layoutPlan);
  if (bufferLength < minBeforeSplit) return false;
  if (likelyPrematureSplit(joined)) return false;

  return true;
}

function dedupeConsecutiveSentences(sentences: string[]): string[] {
  const output: string[] = [];

  for (const sentence of sentences) {
    const last = output[output.length - 1];
    if (!last) {
      output.push(sentence);
      continue;
    }

    if (normalize(last) === normalize(sentence)) {
      continue;
    }

    output.push(sentence);
  }

  return output;
}

function scoreSentences(sentences: string[]): number {
  if (!sentences.length) return 0.25;

  const lengths = sentences.map((item) => sanitizeSentenceText(item).length);
  const veryShort = lengths.filter((len) => len < 24).length;
  const healthy = lengths.filter((len) => len >= 45 && len <= 420).length;

  const healthyRatio = healthy / Math.max(1, sentences.length);
  const shortPenalty = veryShort / Math.max(1, sentences.length);

  const score = 0.58 + healthyRatio * 0.32 - shortPenalty * 0.22;
  return Math.max(0.1, Math.min(0.99, Number(score.toFixed(4))));
}

export function sentenceBuffering(
  input: SentenceBufferingInput,
): SentenceBufferingOutput {
  const maxTokensPerSentence = resolveMaxTokensPerSentence(input);

  const sentences: string[] = [];
  const buffer: string[] = [];

  for (const token of input.tokens || []) {
    buffer.push(token);

    const joined = joinTokens(buffer);
    if (!joined) continue;

    const punctuationDone = endsWithStrongSentencePunctuation(joined);

    const softBoundaryDone =
      endsWithSoftBoundary(joined) &&
      buffer.length >= Math.max(20, Math.floor(maxTokensPerSentence * 0.78)) &&
      !likelyPrematureSplit(joined);

    const limitDone = shouldFlushByLimit(
      joined,
      buffer.length,
      maxTokensPerSentence,
      input.layoutPlan,
    );

    const sentenceDone = punctuationDone || softBoundaryDone || limitDone;
    if (!sentenceDone) continue;

    if (
      likelyPrematureSplit(joined) &&
      buffer.length < Math.max(20, Math.floor(maxTokensPerSentence * 0.82))
    ) {
      continue;
    }

    sentences.push(joined);
    buffer.length = 0;
  }

  if (buffer.length > 0) {
    const tail = joinTokens(buffer);
    if (tail) {
      if (sentences.length > 0 && likelyIncompleteTail(tail)) {
        const previous = sentences[sentences.length - 1];
        sentences[sentences.length - 1] = sanitizeSentenceText(`${previous} ${tail}`);
      } else {
        sentences.push(tail);
      }
    }
  }

  const sanitizedSentences = dedupeConsecutiveSentences(
    sentences.map((sentence) => sanitizeSentenceText(sentence)).filter(Boolean),
  );

  return {
    ok: true,
    component: "sentence-buffering",
    score: scoreSentences(sanitizedSentences),
    sentences: sanitizedSentences,
  };
}