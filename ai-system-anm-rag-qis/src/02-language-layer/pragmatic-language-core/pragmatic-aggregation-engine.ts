/**
 * Responsabilidade do arquivo:
 * - Consolidar sinais pragmaticos em bloco unico para o LanguageState.
 * - Reaproveitar snapshot textual quando disponivel para reduzir retrabalho.
 * - Manter detectores especializados sem sobreposicao de papel.
 */
import type { TextAnalysisSnapshot } from "../../shared/text-processing/text-analysis-snapshot";
import type { PragmaticIntentType, SpeechActType } from "../types/language-signal-types";
import { clamp01 } from "../utils/normalization-utils";
import { directiveForceDetector } from "./directive-force-detector";
import { emphasisDetector } from "./emphasis-detector";
import { implicatureSignalDetector } from "./implicature-signal-detector";
import { indirectRequestDetector } from "./indirect-request-detector";
import { politenessDetector } from "./politeness-detector";
import { pragmaticIntentDetector } from "./pragmatic-intent-detector";
import { relationalCueDetector } from "./relational-cue-detector";
import { speechActDetector } from "./speech-act-detector";

export interface PragmaticAggregationInput {
  text: string;
  snapshot?: TextAnalysisSnapshot;
}

export interface PragmaticAggregationResult {
  speechAct: SpeechActType;
  intent: PragmaticIntentType;
  politeness: number;
  register: "informal" | "balanced" | "formal";
  indirectRequest: boolean;
  directiveForce: number;
  emphasisStrength: number;
  implicatureSignals: string[];
  relationalCues: string[];
}

export function pragmaticAggregationEngine(input: PragmaticAggregationInput): PragmaticAggregationResult {
  const text = input.snapshot?.normalizedText || input.text;

  const speech = speechActDetector({ text });
  const intent = pragmaticIntentDetector({ text, speechAct: speech.speechAct });
  const indirectRequest = indirectRequestDetector({ text });
  const politeness = politenessDetector({ text });
  const emphasis = emphasisDetector({ text });
  const implicature = implicatureSignalDetector({ text });
  const directiveForce = directiveForceDetector({ text });
  const relational = relationalCueDetector({ text });

  return {
    speechAct: speech.speechAct,
    intent: intent.intent,
    politeness: clamp01((speech.politeness + politeness.politeness) / 2),
    register: politeness.register,
    indirectRequest: indirectRequest.detected,
    directiveForce: directiveForce.force,
    emphasisStrength: emphasis.strength,
    implicatureSignals: implicature.signals,
    relationalCues: relational.cues,
  };
}
