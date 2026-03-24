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
  runBehaviorPersonality: true;
  runContext: true;
  runOrchestration: true;
  runMemory: true;
  runKnowledge: boolean;
  runQuantum: boolean;
  runPreparatoryCognitive: boolean;
  runReflective: boolean;
  runInferential: boolean;
  runMetacognitive: boolean;
  runEpistemicIntegration: boolean;
  runGeneration: true;
  runStructure: true;
  runAcademicNormalization: boolean;
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
    runBehaviorPersonality: true,
    runContext: true,
    runOrchestration: true,
    runMemory: true,
    runKnowledge: false,
    runQuantum: false,
    runPreparatoryCognitive: false,
    runReflective: false,
    runInferential: false,
    runMetacognitive: false,
    runEpistemicIntegration: false,
    runGeneration: true,
    runStructure: true,
    runAcademicNormalization: false,
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
    runBehaviorPersonality: true,
    runContext: true,
    runOrchestration: true,
    runMemory: true,
    runKnowledge: false,
    runQuantum: false,
    runPreparatoryCognitive: true,
    runReflective: true,
    runInferential: false,
    runMetacognitive: false,
    runEpistemicIntegration: false,
    runGeneration: true,
    runStructure: true,
    runAcademicNormalization: false,
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
    runBehaviorPersonality: true,
    runContext: true,
    runOrchestration: true,
    runMemory: true,
    runKnowledge: true,
    runQuantum: false,
    runPreparatoryCognitive: true,
    runReflective: true,
    runInferential: true,
    runMetacognitive: true,
    runEpistemicIntegration: true,
    runGeneration: true,
    runStructure: true,
    runAcademicNormalization: false,
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
    runBehaviorPersonality: true,
    runContext: true,
    runOrchestration: true,
    runMemory: true,
    runKnowledge: true,
    runQuantum: true,
    runPreparatoryCognitive: true,
    runReflective: true,
    runInferential: true,
    runMetacognitive: true,
    runEpistemicIntegration: true,
    runGeneration: true,
    runStructure: true,
    runAcademicNormalization: true,
    validationProfile: "strict",
    runPresentation: true,
    runObservability: true,
    runFeedback: true,
    pruningMode: "minimal",
  },
};
