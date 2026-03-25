/**
 * Responsabilidade do arquivo:
 * - Consolidar sinais afetivos/estilisticos em um bloco coerente para LanguageState.
 * - Integrar tom geral, emocao, urgencia, frustracao, confianca, hesitacao e insistencia.
 * - Entregar resultado auditavel com responsabilidade separada por detector.
 */
import { affectivePolarityDetector } from "./affective-polarity-detector";
import { confidenceStyleDetector } from "./confidence-style-detector";
import { emotionalToneDetector } from "./emotional-tone-detector";
import { frustrationSignalDetector } from "./frustration-signal-detector";
import { hesitationDetector } from "./hesitation-detector";
import { insistenceDetector } from "./insistence-detector";
import { toneDetector } from "./tone-detector";
import { urgencyLinguisticDetector } from "./urgency-linguistic-detector";

export interface AffectiveAggregationInput {
  text: string;
}

export interface AffectiveAggregationResult {
  tone: ReturnType<typeof toneDetector>["tone"];
  register: ReturnType<typeof toneDetector>["register"];
  emotionalTone: ReturnType<typeof emotionalToneDetector>["emotionalTone"];
  urgency: ReturnType<typeof urgencyLinguisticDetector>["urgency"];
  urgencyScore: number;
  frustrationScore: number;
  confidenceStyle: ReturnType<typeof confidenceStyleDetector>["confidenceStyle"];
  hesitationScore: number;
  insistenceScore: number;
  affectivePolarity: ReturnType<typeof affectivePolarityDetector>["polarity"];
}

export function affectiveAggregationEngine(input: AffectiveAggregationInput): AffectiveAggregationResult {
  const tone = toneDetector({ text: input.text });
  const emotionalTone = emotionalToneDetector({ text: input.text });
  const urgency = urgencyLinguisticDetector({ text: input.text });
  const frustration = frustrationSignalDetector({ text: input.text });
  const confidenceStyle = confidenceStyleDetector({ text: input.text });
  const hesitation = hesitationDetector({ text: input.text });
  const insistence = insistenceDetector({ text: input.text });
  const polarity = affectivePolarityDetector({ text: input.text });

  return {
    tone: tone.tone,
    register: tone.register,
    emotionalTone: emotionalTone.emotionalTone,
    urgency: urgency.urgency,
    urgencyScore: urgency.urgencyScore,
    frustrationScore: frustration.frustrationScore,
    confidenceStyle: confidenceStyle.confidenceStyle,
    hesitationScore: hesitation.hesitationScore,
    insistenceScore: insistence.insistenceScore,
    affectivePolarity: polarity.polarity,
  };
}

