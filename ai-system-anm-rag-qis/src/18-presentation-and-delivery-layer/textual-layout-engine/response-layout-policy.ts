import { applyParagraphDensityTargets } from "./paragraph-density-planner";
import { resolveHeadingStrategy, resolveListStrategy } from "./heading-list-strategy";
import { selectRhetoricalShape } from "./rhetorical-shape-selector";
import type { ResponseComplexity, ResponseLayoutPlan, ResponseLayoutPolicyInput } from "./response-layout-types";

function sentenceCount(text: string) {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+/g)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveComplexity(text: string, prompt: string): ResponseComplexity {
  const normalizedPrompt = normalize(prompt);
  const chars = `${text || ""}`.trim().length;
  const sentences = sentenceCount(text);
  const deepSignal =
    /\b(analise|análise|formalmente|premissas|trade-?off|obje[çc][aã]o|epistemic|inferencial|filosof)\b/.test(
      normalizedPrompt,
    ) || /\b(a\)|b\)|c\)|d\)|e\)|f\)|g\))\b/.test(normalizedPrompt);

  if (chars <= 120 && sentences <= 2) return "micro";
  if (chars <= 280 && sentences <= 4) return "short";
  if (chars <= 900 && sentences <= 9 && !deepSignal) return "medium";
  if (chars <= 1700 && sentences <= 16) return deepSignal ? "deep" : "long";
  return deepSignal ? "deep" : "long";
}

export function buildResponseLayoutPlan(input: ResponseLayoutPolicyInput): ResponseLayoutPlan {
  const complexity = resolveComplexity(input.text, input.prompt);
  const rhetoricalShape = selectRhetoricalShape(complexity, input);
  const listStrategy = resolveListStrategy(input.prompt, input.text);
  const headingStrategy = resolveHeadingStrategy(input.prompt, input.text);

  const notes: string[] = [
    `complexity=${complexity}`,
    `shape=${rhetoricalShape}`,
    `list=${listStrategy}`,
    `heading=${headingStrategy}`,
  ];

  if (input.hasCodeBlocks) notes.push("preserve_code_blocks");
  if (input.hasCitations) notes.push("preserve_citation_blocks");
  if (input.hasMedia) notes.push("preserve_media_blocks");
  if (input.hasEnumerativeSignals) notes.push("enumerative_signals_detected");

  return applyParagraphDensityTargets({
    complexity,
    rhetoricalShape,
    listStrategy,
    headingStrategy,
    preserveCodeBlocks: input.hasCodeBlocks,
    preserveCitationBlocks: input.hasCitations,
    preserveMediaBlocks: input.hasMedia,
    notes,
  });
}
