import type { QuantumHypothesis } from "../quantum-core-types";
import { alternativeInterpretationBuilder } from "./alternative-interpretation-builder";
import { semanticBranchExpander } from "./semantic-branch-expander";
import { ambiguityPreserver } from "./ambiguity-preserver";
import { hypothesisStateRegistry } from "./hypothesis-state-registry";

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toSnippet(value: string, max = 96) {
  const normalized = normalizeText(value);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}...`;
}

export function generateHypotheses(
  message: string,
  evidenceSnippets: string[],
  sourceUrls: string[],
): QuantumHypothesis[] {
  const seed = normalizeText(message) || "Pergunta sem contexto.";
  const ambiguity = /\b(ou|or|talvez|depends|depende)\b/i.test(seed) ? 0.6 : 0.3;

  const interpretations = alternativeInterpretationBuilder({ message: seed });
  const branches = semanticBranchExpander({
    interpretations: interpretations.interpretations,
    evidenceHints: evidenceSnippets,
  });
  const preserved = ambiguityPreserver({
    branches: branches.branches,
    ambiguity,
  });
  const registry = hypothesisStateRegistry({
    branches: preserved.preserved,
    sourceUrls,
  });

  return registry.hypotheses;
}

export function extractEvidenceHints(evidenceSnippets: string[]): string[] {
  return evidenceSnippets.filter(Boolean).map((item) => toSnippet(item, 88)).slice(0, 4);
}
