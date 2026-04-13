import { applyParagraphDensityTargets } from "./paragraph-density-planner";
import {
  resolveHeadingStrategy,
  resolveListStrategy,
} from "./heading-list-strategy";
import { selectRhetoricalShape } from "./rhetorical-shape-selector";
import type {
  ResponseComplexity,
  ResponseLayoutPlan,
  ResponseLayoutPolicyInput,
} from "./response-layout-types";

function sentenceCount(text: string): number {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+/g)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function hasDeepLexicalSignal(prompt: string): boolean {
  return /\b(analise|analit|formalmente|premissas|trade-?off|objecao|objecoes|epistemic|inferencial|filosof|demonstr|modelo|contradicao|inconsistencia|pressupostos|reformule)\b/.test(
    prompt,
  );
}

function hasEnumeratedTaskSignal(prompt: string): boolean {
  return /\b(a\)|b\)|c\)|d\)|e\)|f\)|g\)|h\)|i\))\b/.test(prompt);
}

function resolveComplexity(input: ResponseLayoutPolicyInput): ResponseComplexity {
  const normalizedPrompt = normalize(input.prompt);
  const text = `${input.text || ""}`.trim();

  const chars = text.length;
  const sentences = sentenceCount(text);

  const obligationCount = Math.max(0, input.obligationCount || 0);
  const pendingObligations = (input.pendingObligations || []).length;

  const reasoningIntensity = clamp01(input.reasoningIntensity || 0);
  const structuralComplexity = clamp01(input.structuralComplexity || 0);

  const routeDeepSignal = /\b(inferential|reflective|quantum-state|deliberative|analysis|reasoning)\b/.test(
    `${input.route || ""}`.toLowerCase(),
  );

  const lexicalDeepSignal =
    hasDeepLexicalSignal(normalizedPrompt) || hasEnumeratedTaskSignal(normalizedPrompt);

  const deliberativeSignal =
    Boolean(input.deliberativeActive) ||
    Boolean(input.requiresStructuredCoverage);

  const contractDepthScore =
    (deliberativeSignal ? 0.28 : 0) +
    Math.min(0.2, obligationCount * 0.035) +
    Math.min(0.12, pendingObligations * 0.03) +
    reasoningIntensity * 0.2 +
    structuralComplexity * 0.2 +
    (input.usesWorkingMemory ? 0.05 : 0) +
    (input.hasEnumerativeSignals ? 0.05 : 0) +
    (routeDeepSignal ? 0.08 : 0) +
    (lexicalDeepSignal ? 0.08 : 0);

  const normalizedDepthScore = clamp01(contractDepthScore);

  if (
    normalizedDepthScore >= 0.56 ||
    obligationCount >= 5 ||
    pendingObligations >= 2 ||
    (deliberativeSignal && (reasoningIntensity >= 0.5 || structuralComplexity >= 0.5))
  ) {
    return "deep";
  }

  if (
    (lexicalDeepSignal || routeDeepSignal) &&
    (chars >= 220 || sentences >= 4 || obligationCount >= 3)
  ) {
    return "deep";
  }

  if (chars <= 120 && sentences <= 2 && obligationCount <= 1) {
    return "micro";
  }

  if (chars <= 280 && sentences <= 4 && obligationCount <= 2 && !lexicalDeepSignal) {
    return "short";
  }

  if (
    chars <= 900 &&
    sentences <= 9 &&
    obligationCount <= 3 &&
    normalizedDepthScore < 0.42
  ) {
    return "medium";
  }

  if (chars <= 1800 && sentences <= 16) {
    return normalizedDepthScore >= 0.48 ? "deep" : "long";
  }

  return normalizedDepthScore >= 0.46 || lexicalDeepSignal || routeDeepSignal
    ? "deep"
    : "long";
}

export function buildResponseLayoutPlan(
  input: ResponseLayoutPolicyInput,
): ResponseLayoutPlan {
  const complexity = resolveComplexity(input);
  const rhetoricalShape = selectRhetoricalShape(complexity, input);
  const listStrategy = resolveListStrategy(input.prompt, input.text);
  const headingStrategy = resolveHeadingStrategy(input.prompt, input.text);

  const obligationCount = Math.max(0, input.obligationCount || 0);
  const pendingObligations = (input.pendingObligations || []).length;
  const reasoningIntensity = clamp01(input.reasoningIntensity || 0);
  const structuralComplexity = clamp01(input.structuralComplexity || 0);

  const notes: string[] = [
    `complexity=${complexity}`,
    `shape=${rhetoricalShape}`,
    `list=${listStrategy}`,
    `heading=${headingStrategy}`,
    `obligations=${obligationCount}`,
    `pending=${pendingObligations}`,
    `reasoning=${reasoningIntensity.toFixed(2)}`,
    `structure=${structuralComplexity.toFixed(2)}`,
  ];

  if (input.hasCodeBlocks) notes.push("preserve_code_blocks");
  if (input.hasCitations) notes.push("preserve_citation_blocks");
  if (input.hasMedia) notes.push("preserve_media_blocks");
  if (input.hasEnumerativeSignals) notes.push("enumerative_signals_detected");
  if (input.deliberativeActive) notes.push("deliberative_layout_bias");
  if (input.requiresStructuredCoverage) notes.push("structured_coverage_required");
  if (input.usesWorkingMemory) notes.push("working_memory_binding");

  if (complexity === "deep") {
    notes.push("prefer_dense_paragraphs");
    notes.push("prefer_long_form_continuity");
  }

  if (pendingObligations > 0) {
    notes.push("keep_continuation_ready");
  }

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