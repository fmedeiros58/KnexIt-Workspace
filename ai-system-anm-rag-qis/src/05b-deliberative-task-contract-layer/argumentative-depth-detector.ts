import type { ArgumentativeDepthResult } from "./deliberative-task-contract-types";
import { classifyCognitiveDemand } from "./cognitive-demand-classifier";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(source: string, patterns: RegExp[]): number {
  return patterns.reduce((acc, pattern) => (pattern.test(source) ? acc + 1 : acc), 0);
}

function countEnumeratedItems(source: string): number {
  const alpha = (source.match(/\(\s*[a-z0-9]+\s*\)/g) || []).length;
  const numeric = (source.match(/\b(?:\d+[\.\)]\s+)[^.;\n]+/g) || []).length;
  return Math.max(alpha, numeric);
}

export function argumentativeDepthDetector(message: string): ArgumentativeDepthResult {
  const normalized = normalize(message);
  if (!normalized) {
    return {
      requiresDeliberativeContract: false,
      argumentativeDepthScore: 0,
      needsFormalization: false,
      needsCounterObjection: false,
      needsAssumptionAudit: false,
      needsStructuredCoverage: false,
    };
  }

  const profile = classifyCognitiveDemand(message);
  const enumeratedItems = countEnumeratedItems(message);

  const formalPatterns = [
    /\bdemonstre\b/,
    /\bdemonstrate\b/,
    /\bformalmente\b/,
    /\bformally\b/,
    /\bshow why\b/,
    /\bmostre por que\b/,
    /\bprove\b/,
    /\bproof\b/,
    /\bderive\b/,
    /\bderivation\b/,
    /\baxioma\b/,
    /\baxiom\b/,
  ];
  const objectionPatterns = [
    /\bmelhor objecao\b/,
    /\bstrongest objection\b/,
    /\bbest objection\b/,
    /\bsteelman\b/,
    /\bcontra argumento\b/,
    /\bcounter argument\b/,
    /\bcounterargument\b/,
    /\bautocritica\b/,
    /\bself critique\b/,
  ];
  const assumptionPatterns = [
    /\bpressupostos?\b/,
    /\bassumptions?\b/,
    /\bpremissas?\b/,
    /\bpremises?\b/,
    /\bsem provar\b/,
    /\bwithout proving\b/,
    /\bunproven\b/,
  ];
  const structurePatterns = [
    /\(\s*[a-z0-9]+\s*\)/,
    /\b(primeiro|segundo|terceiro|ao final|first|second|third|finally)\b/,
    /\b(passo a passo|step by step|etapas?|stages?)\b/,
    /\b(modelos?|models?|alternativas?|alternatives?|criterios|criteria)\b/,
  ];
  const deliberationPatterns = [
    /\b(decidir|decide|escolher|choose|priorizar|prioritize|trade-?off|equilibrar|balance)\b/,
    /\b(restricoes?|constraints?|orcamento|budget|tempo|time|risco|risk|feasibility|viabilidade)\b/,
    /\b(incerteza|uncertainty|estimad|estimate|scenario|cenario)\b/,
    /\b(diagnostique|diagnose|planeje|plan|compare|sintetize|synthesize)\b/,
  ];

  const formalHits = countMatches(normalized, formalPatterns);
  const objectionHits = countMatches(normalized, objectionPatterns);
  const assumptionHits = countMatches(normalized, assumptionPatterns);
  const structureHits = countMatches(normalized, structurePatterns);
  const deliberationHits = countMatches(normalized, deliberationPatterns);

  const score = clamp01(
    (profile.reasoningIntensity * 0.4) +
      (profile.structuralComplexity * 0.24) +
      (formalHits * 0.08) +
      (objectionHits * 0.06) +
      (assumptionHits * 0.05) +
      (structureHits * 0.05) +
      (deliberationHits * 0.04) +
      (Math.min(1, enumeratedItems * 0.04) * 0.08),
  );

  return {
    requiresDeliberativeContract:
      profile.requiresDeliberativeContract ||
      score >= 0.5 ||
      enumeratedItems >= 3 ||
      (structureHits >= 2 && deliberationHits >= 1),
    argumentativeDepthScore: Number(score.toFixed(4)),
    needsFormalization: profile.requiresFormalization || formalHits > 0,
    needsCounterObjection: profile.requiresSelfObjection || objectionHits > 0,
    needsAssumptionAudit: profile.requiresAssumptionAudit || assumptionHits > 0,
    needsStructuredCoverage: profile.requiresStructuredCoverage || structureHits > 0 || enumeratedItems >= 3,
  };
}
