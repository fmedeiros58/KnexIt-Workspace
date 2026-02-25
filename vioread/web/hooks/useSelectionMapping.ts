import { useMemo } from "react";
import type { CitationPayload, LayoutBlock, SelectionMapping, TranslationPair } from "../lib/types";
import { buildCitationPayload } from "../services/citation.service";

type UseSelectionMappingArgs = {
  pageNumber: number;
  sourceLanguage: string;
  targetLanguage: string;
  selected: SelectionMapping | null;
  blocks: LayoutBlock[];
  translationPairs: TranslationPair[];
  onSelect: (selection: SelectionMapping | null) => void;
};

export function useSelectionMapping(args: UseSelectionMappingArgs) {
  const selectedBlock = useMemo(
    () => args.blocks.find((block) => block.id === args.selected?.blockId) ?? null,
    [args.blocks, args.selected?.blockId],
  );

  const pairByBlockId = useMemo(() => {
    const map = new Map<string, TranslationPair>();
    args.translationPairs.forEach((pair) => map.set(pair.blockId, pair));
    return map;
  }, [args.translationPairs]);

  const selectedPair = selectedBlock ? pairByBlockId.get(selectedBlock.id) ?? null : null;

  const selectBlock = (blockId: string, side: SelectionMapping["side"], pageNumber = args.pageNumber) => {
    args.onSelect({ pageNumber, blockId, side });
  };

  const clearSelection = () => args.onSelect(null);

  const citationDirect: CitationPayload | null = selectedBlock
    ? buildCitationPayload({
        pageNumber: args.pageNumber,
        sourceLanguage: args.sourceLanguage,
        targetLanguage: args.targetLanguage,
        block: selectedBlock,
        pair: selectedPair ?? undefined,
        mode: "direct",
      })
    : null;

  const citationIndirect: CitationPayload | null = selectedBlock
    ? buildCitationPayload({
        pageNumber: args.pageNumber,
        sourceLanguage: args.sourceLanguage,
        targetLanguage: args.targetLanguage,
        block: selectedBlock,
        pair: selectedPair ?? undefined,
        mode: "indirect",
      })
    : null;

  return {
    selectedBlock,
    selectedPair,
    selectBlock,
    clearSelection,
    citationDirect,
    citationIndirect,
  };
}

