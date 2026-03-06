import type { ConstructionRules } from "@/core/rag/v2/writer/construction_rules_orchestrator";

export type TokenBudgetInput = {
  requestedMaxTokens: number;
  deepMode: boolean;
  hasDocumentScope: boolean;
  rules: ConstructionRules;
};

export type TokenBudgetPlan = {
  sectionMinTokens: number;
  sectionMaxTokens: number;
  mergeMinTokens: number;
  mergeMaxTokens: number;
  sectionTopK: number;
  contextBudgetTokens: number;
};

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function resolveDynamicTokenBudget(input: TokenBudgetInput): TokenBudgetPlan {
  const requested = clamp(Math.trunc(input.requestedMaxTokens || 3200), 1024, 65_536);
  const heavy = input.deepMode || input.hasDocumentScope;
  const verbosityMultiplier = 1 + (input.rules.weights.verbosity - 50) / 220;
  const depthMultiplier = 1 + (input.rules.weights.depth - 50) / 240;
  const structureMultiplier = heavy ? 1.22 : 1.0;
  const styleMultiplier = input.rules.citationStyle === "none" ? 1 : 1.08;
  const dynamicMultiplier = clamp(verbosityMultiplier * depthMultiplier * structureMultiplier * styleMultiplier, 0.9, 2.2);

  const globalMinSection = parsePositiveInt(process.env.RAG_V2_WRITER_SECTION_MIN_TOKENS, heavy ? 2200 : 1600, 768, 12_288);
  const globalMaxSection = parsePositiveInt(process.env.RAG_V2_WRITER_SECTION_MAX_TOKENS, heavy ? 7600 : 5600, 1600, 20_480);
  const globalMinMerge = parsePositiveInt(process.env.RAG_V2_WRITER_MERGE_MIN_TOKENS, heavy ? 4200 : 3000, 1800, 20_480);
  const globalMaxMerge = parsePositiveInt(process.env.RAG_V2_WRITER_MERGE_MAX_TOKENS, heavy ? 12288 : 8192, 2600, 32_768);

  const scaledSection = clamp(Math.round(requested * 0.72 * dynamicMultiplier), globalMinSection, globalMaxSection);
  const scaledMerge = clamp(Math.round(requested * 1.05 * dynamicMultiplier), globalMinMerge, globalMaxMerge);

  const paragraphSpan = Math.max(1, input.rules.targetParagraphsMax - input.rules.targetParagraphsMin + 1);
  const topKBase = heavy ? 14 : 10;
  const topKByDensity = Math.round(topKBase + paragraphSpan * 0.9 + (input.rules.weights.grounding - 50) / 18);
  const sectionTopK = clamp(topKByDensity, 8, 40);

  const contextBudgetTokens = clamp(
    Math.round(1800 + sectionTopK * 55 + (input.rules.weights.grounding - 50) * 9),
    1200,
    18_000,
  );

  return {
    sectionMinTokens: globalMinSection,
    sectionMaxTokens: scaledSection,
    mergeMinTokens: globalMinMerge,
    mergeMaxTokens: scaledMerge,
    sectionTopK,
    contextBudgetTokens,
  };
}
