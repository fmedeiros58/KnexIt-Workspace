import { decodeLikelyMojibake } from "../shared/text-processing/mojibake-core";

function normalizeSentence(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseRepeatedSentences(value: string): string {
  const sentences = value
    .split(/(?<=[.!?])\s+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!sentences.length) return value;

  const unique: string[] = [];
  let last = "";
  for (const sentence of sentences) {
    const normalized = normalizeSentence(sentence);
    if (normalized && normalized === last) continue;
    last = normalized;
    unique.push(sentence);
  }

  return unique.join(" ").trim();
}

export function finalPolisher(text: string): string {
  let polished = decodeLikelyMojibake(collapseRepeatedSentences(text))
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\s+:/g, ":")
    .replace(/\s+;/g, ";")
    .replace(/([!?])\s*\./g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  const words = polished.split(/\s+/g).filter(Boolean);
  if (words.length >= 6 && words.length % 2 === 0) {
    const half = words.length / 2;
    const first = words.slice(0, half).join(" ");
    const second = words.slice(half).join(" ");
    if (normalizeSentence(first) === normalizeSentence(second)) {
      polished = first;
    }
  }

  if (polished && !/[.!?]$/.test(polished) && polished.length > 40) {
    polished += ".";
  }

  return polished;
}
