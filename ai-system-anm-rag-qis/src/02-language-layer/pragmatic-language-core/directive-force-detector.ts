/**
 * Responsabilidade do arquivo:
 * - Medir forca diretiva com base em multiplos indicios.
 * - Nao depender so de verbos isolados.
 * - Considerar mitigacao, intensidade e obrigacao.
 */
import { pragmaticNormalizer } from "./pragmatic-normalizer";
import {
  DIRECTIVE_FAMILIES,
  MITIGATION_FAMILIES,
  EMPHASIS_FAMILIES,
} from "./pragmatic-pattern-library";
import { pragmaticScoreCalibrator } from "./pragmatic-score-calibrator";

export interface DirectiveForceDetectorInput {
  text: string;
}

export interface DirectiveForceDetectorResult {
  force: number;
  directHits: string[];
  mitigationHits: string[];
  emphasisHits: string[];
}

function collectHits(text: string, families: { name: string; patterns: RegExp[] }[]) {
  const hits: string[] = [];
  for (const family of families) {
    for (const pattern of family.patterns) {
      if (pattern.test(text)) hits.push(family.name);
    }
  }
  return [...new Set(hits)];
}

export function directiveForceDetector(
  input: DirectiveForceDetectorInput,
): DirectiveForceDetectorResult {
  const normalized = pragmaticNormalizer({ text: input.text });
  const text = normalized.compactText;

  const directHits = collectHits(text, DIRECTIVE_FAMILIES);
  const mitigationHits = collectHits(text, MITIGATION_FAMILIES);
  const emphasisHits = collectHits(text, EMPHASIS_FAMILIES);
  const hasExclamation = /!/.test(normalized.originalText);

  const force = pragmaticScoreCalibrator({
    base: 0.18,
    positiveHits: directHits.length + emphasisHits.length,
    negativeHits: mitigationHits.length,
    positiveWeight: 0.16,
    negativeWeight: 0.11,
    bonus: hasExclamation ? 0.07 : 0,
  });

  return {
    force,
    directHits,
    mitigationHits,
    emphasisHits,
  };
}
