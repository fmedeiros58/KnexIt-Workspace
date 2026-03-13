import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { runInputLayer } from "../01-input-layer/input-layer-bridge";
import { runContextLayer } from "../02-context-and-session-layer/context-layer-bridge";
import { runOrchestrationLayer } from "../03-complexity-and-orchestration-layer/orchestration-layer-bridge";
import { runMemoryLayer } from "../04-memory-and-plasticity-layer/memory-layer-bridge";
import { runKnowledgeLayer } from "../05-knowledge-retrieval-and-research-layer/knowledge-layer-bridge";
import { runQuantumLayer } from "../06-quantum-information-state-layer/quantum-layer-bridge";
import { runReflectiveLayer } from "../07-reflective-layer/reflective-layer-bridge";
import { runGenerationLayer } from "../09-reasoning-and-generation-layer/generation-layer-bridge";
import { runStructureLayer } from "../10-response-structure-engine/structure-layer-bridge";
import { runValidationLayer } from "../11-validation-layer/validation-layer-bridge";
import { runPresentationLayer } from "../12-presentation-and-delivery-layer/presentation-layer-bridge";
import { runObservabilityLayer } from "../13-observability-control-and-admin-layer/observability-layer-bridge";
import { runFeedbackLayer } from "../14-feedback-learning-and-memory-update-layer/feedback-layer-bridge";

export async function runReflectiveFlow(state: ProcessingState, route: PipelineRoute) {
  state.executionPlan.selectedRoute = route;
  await runInputLayer(state);
  await runContextLayer(state);
  await runOrchestrationLayer(state);
  await runMemoryLayer(state);
  await runKnowledgeLayer(state);
  await runQuantumLayer(state);
  await runReflectiveLayer(state);
  await runGenerationLayer(state);
  await runStructureLayer(state);
  await runValidationLayer(state);
  await runPresentationLayer(state);
  await runObservabilityLayer(state);
  await runFeedbackLayer(state);
  return state;
}

