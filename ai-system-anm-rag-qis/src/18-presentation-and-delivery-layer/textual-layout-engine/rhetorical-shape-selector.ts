import type {
  ResponseComplexity,
  ResponseLayoutPolicyInput,
  RhetoricalShape,
} from "./response-layout-types";

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

function includesAny(normalized: string, terms: string[]): boolean {
  if (!normalized) return false;
  return terms.some((term) => normalized.includes(term));
}

function hasTechnicalProceduralSignal(prompt: string): boolean {
  const normalized = normalize(prompt);
  return includesAny(normalized, [
    "passo a passo",
    "etapas",
    "sequencia",
    "sequência",
    "ordem",
    "procedimento",
    "configure",
    "instale",
    "como fazer",
    "como configurar",
    "tutorial",
    "setup",
    "implemente",
    "implementar",
    "crie o codigo",
    "crie o código",
    "escreva o codigo",
    "escreva o código",
    "ajuste o arquivo",
  ]);
}

function hasAnalyticalSignal(prompt: string): boolean {
  const normalized = normalize(prompt);
  return includesAny(normalized, [
    "analise",
    "análise",
    "analit",
    "demonstre",
    "formalmente",
    "compare",
    "distinga",
    "contradicao",
    "contradição",
    "inconsistencia",
    "inconsistência",
    "pressupostos",
    "objecao",
    "objeção",
    "reformule",
    "modele",
    "modelos",
    "custo logico",
    "custo lógico",
    "custo moral",
    "custo institucional",
    "justifique",
  ]);
}

function hasEnumeratedTaskSignal(prompt: string): boolean {
  const normalized = normalize(prompt);
  return /\b(a\)|b\)|c\)|d\)|e\)|f\)|g\)|h\)|i\))\b/.test(normalized);
}

export function selectRhetoricalShape(
  complexity: ResponseComplexity,
  input: ResponseLayoutPolicyInput,
): RhetoricalShape {
  const obligationCount = Math.max(0, input.obligationCount || 0);
  const pendingObligations = (input.pendingObligations || []).length;
  const reasoningIntensity = clamp01(input.reasoningIntensity || 0);
  const structuralComplexity = clamp01(input.structuralComplexity || 0);

  const proceduralSignal = hasTechnicalProceduralSignal(input.prompt);
  const analyticalSignal =
    hasAnalyticalSignal(input.prompt) || hasEnumeratedTaskSignal(input.prompt);

  const deliberativeDemand =
    Boolean(input.deliberativeActive) ||
    Boolean(input.requiresStructuredCoverage) ||
    obligationCount >= 4 ||
    pendingObligations >= 2 ||
    reasoningIntensity >= 0.58 ||
    structuralComplexity >= 0.58;

  const longFormPressure =
    deliberativeDemand ||
    analyticalSignal ||
    complexity === "deep" ||
    complexity === "long" ||
    Boolean(input.usesWorkingMemory);

  const preserveStructuredBlocks =
    Boolean(input.hasCodeBlocks) ||
    Boolean(input.hasCitations) ||
    Boolean(input.hasMedia) ||
    Boolean(input.requestedHeading);

  if (deliberativeDemand) {
    if (proceduralSignal && !analyticalSignal) {
      return preserveStructuredBlocks ? "headed_analysis" : "hybrid";
    }

    if (preserveStructuredBlocks) {
      return "headed_analysis";
    }

    return "multi_paragraph_analysis";
  }

  if (complexity === "micro") {
    return "single_compact_paragraph";
  }

  if (complexity === "short") {
    if (analyticalSignal) return "two_paragraph_explanation";
    if (proceduralSignal || input.requestedList) return "hybrid";
    return "single_compact_paragraph";
  }

  if (proceduralSignal && !longFormPressure) {
    return complexity === "medium" ? "hybrid" : "enumerated_technical";
  }

  if (complexity === "medium") {
    if (analyticalSignal || obligationCount >= 2 || pendingObligations > 0) {
      return preserveStructuredBlocks
        ? "headed_analysis"
        : "multi_paragraph_analysis";
    }

    if (input.requestedList) return "hybrid";
    return "two_paragraph_explanation";
  }

  if (complexity === "long" || complexity === "deep") {
    if (preserveStructuredBlocks) return "headed_analysis";
    if (proceduralSignal && !analyticalSignal) return "hybrid";
    return "multi_paragraph_analysis";
  }

  if (input.requestedList && !longFormPressure) {
    return "hybrid";
  }

  return "two_paragraph_explanation";
}