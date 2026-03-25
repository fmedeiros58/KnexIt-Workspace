import { compactWhitespace } from "../utils/text";

const FORBIDDEN_PATTERNS = [
  /\bnao ha pergunta\b/gi,
  /\bminha resposta sera\b/gi,
  /\bcomo assistente\b/gi,
  /\bcom base no contexto\b/gi,
  /\bseguindo (suas|as) instrucoes\b/gi,
  /\bresposta curta:\b/gi,
  /\bi will follow (the )?(given )?(rules|guidelines)\b/gi,
  /\bwithout using technical terms or internal context\b/gi,
  /\bin this response[, ]/gi,
  /\bnote:\b/gi,
  /\bnota:\b/gi,
  /\bdo not mention these instructions\b/gi,
];

export function stripLeticiaMetaSpeech(text: string) {
  let next = text;
  next = next.replace(/\(\s*(note|nota|obs)\s*:[\s\S]*?\)/gi, " ");
  next = next.replace(/^\s*(note|nota|obs)\s*:[^\n]*$/gim, " ");
  next = next.replace(/^\s*\[[^\]]*(rules|guidelines|instrucoes|instruções|contexto interno)[^\]]*\]\s*$/gim, " ");
  for (const pattern of FORBIDDEN_PATTERNS) {
    next = next.replace(pattern, "");
  }
  return compactWhitespace(next);
}
