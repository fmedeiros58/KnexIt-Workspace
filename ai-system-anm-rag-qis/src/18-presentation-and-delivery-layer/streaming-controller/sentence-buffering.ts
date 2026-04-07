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
];

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function endsWithContinuityCue(text: string) {
  const normalized = normalize(text);
  if (!normalized) return false;
  return CONTINUITY_TAIL.some((cue) => normalized.endsWith(cue));
}

function likelyPrematureSplit(text: string) {
  const normalized = `${text || ""}`.trim();
  if (!normalized) return true;
  if (normalized.length <= 35) return true;
  if (/[,:;]\s*$/.test(normalized)) return true;
  if (endsWithContinuityCue(normalized)) return true;
  return false;
}

export function sentenceBuffering(input: SentenceBufferingInput): SentenceBufferingOutput {
  const layoutAwareMax = input.layoutPlan
    ? Math.max(18, input.layoutPlan.targetParagraphSentenceRange[1] * 18)
    : 48;
  const maxTokensPerSentence = Number.isFinite(input.maxTokensPerSentence)
    ? Math.max(8, Math.trunc(input.maxTokensPerSentence as number))
    : layoutAwareMax;

  const sentences: string[] = [];
  const buffer: string[] = [];

  for (const token of input.tokens || []) {
    buffer.push(token);
    const joined = buffer.join("");
    const punctuationDone = /[.!?]\s*$/.test(joined);
    const limitDone = buffer.length >= maxTokensPerSentence;
    const sentenceDone = punctuationDone || limitDone;
    if (!sentenceDone) continue;

    if (likelyPrematureSplit(joined) && buffer.length < Math.max(14, Math.floor(maxTokensPerSentence * 0.6))) {
      continue;
    }

    sentences.push(joined.trim());
    buffer.length = 0;
  }

  if (buffer.length > 0) {
    sentences.push(buffer.join("").trim());
  }

  return {
    ok: true,
    component: "sentence-buffering",
    score: sentences.length > 0 ? 0.87 : 0.38,
    sentences,
  };
}
