/**
 * Responsabilidade do arquivo:
 * - Inferir intencao pragmatica predominante.
 * - Nao depender apenas do speechAct.
 * - Incorporar forca diretiva, pedido indireto, implicatura e pistas relacionais.
 */
import type { PragmaticIntentType, SpeechActType } from "../types/language-signal-types";
import { pragmaticNormalizer } from "./pragmatic-normalizer";
import {
  ALIGNMENT_FAMILIES,
  CLARIFICATION_FAMILIES,
  FOLLOW_UP_DIRECTIVE_FAMILIES,
} from "./pragmatic-pattern-library";

export interface PragmaticIntentDetectorInput {
  text: string;
  speechAct: SpeechActType;
  directiveForce?: number;
  indirectRequest?: boolean;
  relationalCues?: string[];
  implicatureSignals?: string[];
}

export interface PragmaticIntentDetectorResult {
  intent: PragmaticIntentType;
  rationale: string;
}

export function pragmaticIntentDetector(
  input: PragmaticIntentDetectorInput,
): PragmaticIntentDetectorResult {
  const normalized = pragmaticNormalizer({ text: input.text });
  const text = normalized.compactText;
  const directiveForce = input.directiveForce ?? 0;
  const indirectRequest = input.indirectRequest ?? false;
  const relationalCues = input.relationalCues ?? [];
  const implicatureSignals = input.implicatureSignals ?? [];

  const hasAlignmentCue = ALIGNMENT_FAMILIES.some((family) =>
    family.patterns.some((pattern) => pattern.test(text)),
  );

  const hasClarificationCue = CLARIFICATION_FAMILIES.some((family) =>
    family.patterns.some((pattern) => pattern.test(text)),
  );

  const hasFollowUpDirective = FOLLOW_UP_DIRECTIVE_FAMILIES.some((family) =>
    family.patterns.some((pattern) => pattern.test(text)),
  );

  if (hasFollowUpDirective) {
    return { intent: "execute_change", rationale: "follow-up directive cue" };
  }

  if (relationalCues.length > 0) {
    return { intent: "social_contact", rationale: "relational cues detected" };
  }

  if (
    input.speechAct === "instruction" ||
    input.speechAct === "request" ||
    directiveForce >= 0.62 ||
    indirectRequest
  ) {
    return { intent: "execute_change", rationale: "directive load detected" };
  }

  if (input.speechAct === "question") {
    if (hasClarificationCue) {
      return { intent: "ask_clarification", rationale: "clarification cue" };
    }
    if (hasAlignmentCue) {
      return { intent: "seek_alignment", rationale: "alignment cue detected" };
    }
    return { intent: "ask_information", rationale: "information question" };
  }

  if (input.speechAct === "objection" || implicatureSignals.length > 0) {
    return { intent: "challenge", rationale: "critical signal detected" };
  }

  if (input.speechAct === "greeting") {
    return { intent: "social_contact", rationale: "greeting act" };
  }

  return { intent: "unknown", rationale: "no strong pragmatic intent" };
}
