/**
 * Responsabilidade do arquivo:
 * - Classificar ato de fala com base mais robusta.
 * - Distinguir pergunta, pedido, instrucao, objecao, correcao, saudacao e confirmacao.
 * - Nao depender apenas de pontuacao final.
 */
import type { SpeechActType } from "../types/language-signal-types";
import { pragmaticNormalizer } from "./pragmatic-normalizer";
import {
  QUESTION_FAMILIES,
  DIRECTIVE_FAMILIES,
  OBJECTION_FAMILIES,
  CORRECTION_FAMILIES,
  POLITENESS_FAMILIES,
  GREETING_FAMILIES,
  CONFIRMATION_FAMILIES,
  LOW_POLITENESS_FAMILIES,
} from "./pragmatic-pattern-library";
import { pragmaticScoreCalibrator } from "./pragmatic-score-calibrator";

export interface SpeechActDetectionInput {
  text: string;
}

export interface SpeechActDetection {
  speechAct: SpeechActType;
  politeness: number;
  evidence: string[];
}

function hitNames(text: string, families: { name: string; patterns: RegExp[] }[]) {
  const names: string[] = [];
  for (const family of families) {
    for (const pattern of family.patterns) {
      if (pattern.test(text)) {
        names.push(family.name);
        break;
      }
    }
  }
  return names;
}

function hasAnyHit(text: string, families: { name: string; patterns: RegExp[] }[]) {
  return families.some((family) => family.patterns.some((pattern) => pattern.test(text)));
}

export function speechActDetector(
  input: SpeechActDetectionInput,
): SpeechActDetection {
  const normalized = pragmaticNormalizer({ text: input.text });
  const text = normalized.compactText;

  const greeting = hasAnyHit(text, GREETING_FAMILIES);
  const correctionHits = hitNames(text, CORRECTION_FAMILIES);
  const objectionHits = hitNames(text, OBJECTION_FAMILIES);
  const directiveHits = hitNames(text, DIRECTIVE_FAMILIES);
  const questionHits = hitNames(text, QUESTION_FAMILIES);
  const politenessHits = hitNames(text, POLITENESS_FAMILIES);
  const lowPolitenessHits = hitNames(text, LOW_POLITENESS_FAMILIES);
  const hasQuestionMark = /\?/.test(normalized.originalText);
  const confirmation = hasAnyHit(text, CONFIRMATION_FAMILIES);

  let speechAct: SpeechActType = "statement";

  if (greeting) speechAct = "greeting";
  else if (correctionHits.length > 0) speechAct = "correction";
  else if (objectionHits.length > 0) speechAct = "objection";
  else if (directiveHits.length > 0 && hasQuestionMark) speechAct = "request";
  else if (directiveHits.length > 0) speechAct = "instruction";
  else if (hasQuestionMark || questionHits.length > 0) speechAct = "question";
  else if (confirmation) speechAct = "confirmation";

  return {
    speechAct,
    politeness: pragmaticScoreCalibrator({
      base: 0.44,
      positiveHits: politenessHits.length,
      negativeHits: lowPolitenessHits.length,
      positiveWeight: 0.14,
      negativeWeight: 0.08,
      bonus: hasQuestionMark ? 0.05 : 0,
    }),
    evidence: [
      ...correctionHits,
      ...objectionHits,
      ...directiveHits,
      ...questionHits,
      ...politenessHits,
    ],
  };
}
