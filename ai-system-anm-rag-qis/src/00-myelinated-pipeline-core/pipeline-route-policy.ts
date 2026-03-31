/**
 * Responsabilidade do arquivo:
 * - Definir politica executavel por rota do pipeline (camadas, validacao e pruning).
 * - Garantir que "selectedRoute" tenha comportamento operacional consistente.
 * - Servir de base unica para gates de execucao seletiva.
 */
import type { PipelineRoute } from "../shared/enums/pipeline-enums";

export interface RouteExecutionPolicy {
  runInput: true;
  runLanguage: true;
  runConversation: true;
  runAffectiveSignal: true;
  runContext: true;
  runOrchestration: true;
  runMemory: true;
  runResponsePlanning: true;
  runKnowledge: boolean;
  runQuantum: boolean;
  runPreparatoryCognitive: boolean;
  runReflective: boolean;
  runInferential: boolean;
  runMetacognitive: boolean;
  runFounderInfluence: boolean;
  runEpistemicIntegration: boolean;
  runGeneration: true;
  runStructure: true;
  runAcademicNormalization: boolean;
  runResponseBehavior: true;
  runProactivityGate: true;
  runDeliveryProfile: true;
  runLinguisticHumanizer: true;
  runResponseCalibration: true;
  validationProfile: "light" | "standard" | "strict";
  runPresentation: true;
  runObservability: true;
  runFeedback: true;
  pruningMode: "aggressive" | "moderate" | "minimal";
}

export const ROUTE_EXECUTION_POLICY: Record<PipelineRoute, RouteExecutionPolicy> = {
  minimum: {
    runInput: true,
    runLanguage: true,
    runConversation: true,
    runAffectiveSignal: true,
    runContext: true,
    runOrchestration: true,
    runMemory: true,
    runResponsePlanning: true,
    runKnowledge: true,
    runQuantum: true,
    runPreparatoryCognitive: true,
    runReflective: true,
    runInferential: true,
    runMetacognitive: true,
    runFounderInfluence: true,
    runEpistemicIntegration: true,
    runGeneration: true,
    runStructure: true,
    runAcademicNormalization: true,
    runResponseBehavior: true,
    runProactivityGate: true,
    runDeliveryProfile: true,
    runLinguisticHumanizer: true,
    runResponseCalibration: true,
    validationProfile: "light",
    runPresentation: true,
    runObservability: true,
    runFeedback: true,
    pruningMode: "aggressive",
  },
  reflective: {
    runInput: true,
    runLanguage: true,
    runConversation: true,
    runAffectiveSignal: true,
    runContext: true,
    runOrchestration: true,
    runMemory: true,
    runResponsePlanning: true,
    runKnowledge: true,
    runQuantum: true,
    runPreparatoryCognitive: true,
    runReflective: true,
    runInferential: true,
    runMetacognitive: true,
    runFounderInfluence: true,
    runEpistemicIntegration: true,
    runGeneration: true,
    runStructure: true,
    runAcademicNormalization: true,
    runResponseBehavior: true,
    runProactivityGate: true,
    runDeliveryProfile: true,
    runLinguisticHumanizer: true,
    runResponseCalibration: true,
    validationProfile: "standard",
    runPresentation: true,
    runObservability: true,
    runFeedback: true,
    pruningMode: "moderate",
  },
  inferential: {
    runInput: true,
    runLanguage: true,
    runConversation: true,
    runAffectiveSignal: true,
    runContext: true,
    runOrchestration: true,
    runMemory: true,
    runResponsePlanning: true,
    runKnowledge: true,
    runQuantum: true,
    runPreparatoryCognitive: true,
    runReflective: true,
    runInferential: true,
    runMetacognitive: true,
    runFounderInfluence: true,
    runEpistemicIntegration: true,
    runGeneration: true,
    runStructure: true,
    runAcademicNormalization: true,
    runResponseBehavior: true,
    runProactivityGate: true,
    runDeliveryProfile: true,
    runLinguisticHumanizer: true,
    runResponseCalibration: true,
    validationProfile: "standard",
    runPresentation: true,
    runObservability: true,
    runFeedback: true,
    pruningMode: "moderate",
  },
  "quantum-state": {
    runInput: true,
    runLanguage: true,
    runConversation: true,
    runAffectiveSignal: true,
    runContext: true,
    runOrchestration: true,
    runMemory: true,
    runResponsePlanning: true,
    runKnowledge: true,
    runQuantum: true,
    runPreparatoryCognitive: true,
    runReflective: true,
    runInferential: true,
    runMetacognitive: true,
    runFounderInfluence: true,
    runEpistemicIntegration: true,
    runGeneration: true,
    runStructure: true,
    runAcademicNormalization: true,
    runResponseBehavior: true,
    runProactivityGate: true,
    runDeliveryProfile: true,
    runLinguisticHumanizer: true,
    runResponseCalibration: true,
    validationProfile: "strict",
    runPresentation: true,
    runObservability: true,
    runFeedback: true,
    pruningMode: "minimal",
  },
};
