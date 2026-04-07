import type { ResponseComplexity, RhetoricalShape, ResponseLayoutPolicyInput } from "./response-layout-types";

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasTechnicalProceduralSignal(prompt: string) {
  const normalized = normalize(prompt);
  if (!normalized) return false;
  return /\b(passo a passo|etapas|sequencia|ordem|procedimento|configure|instale|como fazer|como configurar)\b/.test(normalized);
}

export function selectRhetoricalShape(
  complexity: ResponseComplexity,
  input: ResponseLayoutPolicyInput,
): RhetoricalShape {
  if (complexity === "micro" || complexity === "short") {
    return "single_compact_paragraph";
  }

  if (input.requestedList || hasTechnicalProceduralSignal(input.prompt)) {
    return complexity === "medium" ? "hybrid" : "enumerated_technical";
  }

  if (complexity === "medium") {
    return "two_paragraph_explanation";
  }

  if (complexity === "long" || complexity === "deep") {
    if (input.requestedHeading || (input.hasCodeBlocks && input.hasCitations)) {
      return "headed_analysis";
    }
    return "multi_paragraph_analysis";
  }

  return "two_paragraph_explanation";
}
