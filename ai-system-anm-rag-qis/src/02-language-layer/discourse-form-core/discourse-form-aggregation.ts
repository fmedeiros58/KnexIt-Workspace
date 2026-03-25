/**
 * Responsabilidade do arquivo:
 * - Consolidar sinais discursivos (frase, fragmento, repeticao, reparo, topico).
 * - Produzir bloco unico de forma discursiva para o LanguageState.
 * - Manter separacao clara entre forma do turno e interpretacao pragmatica.
 */
import { dialogueStructureDetector } from "./dialogue-structure-detector";
import { discourseMarkerDetector } from "./discourse-marker-detector";
import { fragmentDetector } from "./fragment-detector";
import { repetitionPatternDetector } from "./repetition-pattern-detector";
import { repairSequenceDetector } from "./repair-sequence-detector";
import { rhetoricalQuestionDetector } from "./rhetorical-question-detector";
import { sentenceBoundaryDetector } from "./sentence-boundary-detector";
import { topicShiftSignalDetector } from "./topic-shift-signal-detector";

export interface DiscourseFormAggregationInput {
  text: string;
}

export interface DiscourseFormAggregationResult {
  sentenceCount: number;
  fragmentDetected: boolean;
  rhetoricalQuestionDetected: boolean;
  repetitionDetected: boolean;
  repetitionSegments: string[];
  discourseMarkers: string[];
  topicShiftDetected: boolean;
  repairSignals: ReturnType<typeof repairSequenceDetector>["repairSignals"];
  dialogueShape: ReturnType<typeof dialogueStructureDetector>["dialogueShape"];
}

export function discourseFormAggregation(input: DiscourseFormAggregationInput): DiscourseFormAggregationResult {
  const sentence = sentenceBoundaryDetector({ text: input.text });
  const fragment = fragmentDetector({ text: input.text });
  const rhetorical = rhetoricalQuestionDetector({ text: input.text });
  const repetition = repetitionPatternDetector({ text: input.text });
  const markers = discourseMarkerDetector({ text: input.text });
  const topicShift = topicShiftSignalDetector({ text: input.text });
  const repair = repairSequenceDetector({ text: input.text });
  const dialogueStructure = dialogueStructureDetector({ text: input.text });

  return {
    sentenceCount: sentence.sentences.length,
    fragmentDetected: fragment.fragmentDetected,
    rhetoricalQuestionDetected: rhetorical.rhetoricalQuestionDetected,
    repetitionDetected: repetition.repetitionDetected,
    repetitionSegments: repetition.repeatedSegments,
    discourseMarkers: markers.markers,
    topicShiftDetected: topicShift.topicShiftDetected,
    repairSignals: repair.repairSignals,
    dialogueShape: dialogueStructure.dialogueShape,
  };
}

