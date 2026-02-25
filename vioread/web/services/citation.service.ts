import type { CitationPayload, LayoutBlock, TranslationPair } from "../lib/types";

function quote(text: string) {
  const clean = text.trim();
  return clean ? `"${clean}"` : "";
}

export function buildCitationPayload(args: {
  pageNumber: number;
  sourceLanguage: string;
  targetLanguage: string;
  block: LayoutBlock;
  pair?: TranslationPair;
  mode: "direct" | "indirect";
}): CitationPayload {
  const original = args.block.text;
  const translated = args.pair?.translatedText ?? "";

  const citationText =
    args.mode === "direct"
      ? [
          `Citação direta (p. ${args.pageNumber})`,
          `Original [${args.sourceLanguage}]: ${quote(original)}`,
          `Tradução [${args.targetLanguage}]: ${quote(translated)}`,
        ].join("\n")
      : [
          `Citação indireta (p. ${args.pageNumber})`,
          `Síntese [${args.targetLanguage}]: ${translated || original}`,
          `Base original [${args.sourceLanguage}]: ${quote(original)}`,
        ].join("\n");

  return {
    pageNumber: args.pageNumber,
    mode: args.mode,
    sourceLanguage: args.sourceLanguage,
    targetLanguage: args.targetLanguage,
    original,
    translated,
    citationText,
  };
}

