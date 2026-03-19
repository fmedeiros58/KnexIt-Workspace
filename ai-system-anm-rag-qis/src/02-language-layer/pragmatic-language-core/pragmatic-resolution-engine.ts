/**
 * Responsabilidade do arquivo:
 * - Resolver conflitos entre sinais pragmaticos.
 * - Produzir leitura consolidada mais robusta que regex isolada.
 */
import type { PragmaticIntentType, SpeechActType } from "../types/language-signal-types";

export interface PragmaticResolutionInput {
  speechAct: SpeechActType;
  directiveForce: number;
  indirectRequest: boolean;
  emphasisStrength: number;
  implicatureSignals: string[];
  relationalCues: string[];
  politeness: number;
  currentIntent: PragmaticIntentType;
}

export interface PragmaticResolutionResult {
  resolvedSpeechAct: SpeechActType;
  resolvedIntent: PragmaticIntentType;
  notes: string[];
}

export function pragmaticResolutionEngine(
  input: PragmaticResolutionInput,
): PragmaticResolutionResult {
  const notes: string[] = [];
  let resolvedSpeechAct = input.speechAct;
  let resolvedIntent = input.currentIntent;

  if (
    input.speechAct === "question" &&
    (input.directiveForce >= 0.58 || input.indirectRequest)
  ) {
    resolvedSpeechAct = "request";
    notes.push("question_reinterpreted_as_request");
  }

  if (
    input.currentIntent === "ask_information" &&
    (input.directiveForce >= 0.62 || input.indirectRequest)
  ) {
    resolvedIntent = "execute_change";
    notes.push("intent_upgraded_to_execute_change");
  }

  if (input.relationalCues.length > 0 && resolvedIntent === "unknown") {
    resolvedIntent = "social_contact";
    notes.push("relational_cues_detected");
  }

  if (
    input.implicatureSignals.length > 0 &&
    resolvedIntent === "ask_information" &&
    input.directiveForce < 0.45
  ) {
    resolvedIntent = "challenge";
    notes.push("critical_implicature_shift");
  }

  return {
    resolvedSpeechAct,
    resolvedIntent,
    notes,
  };
}
