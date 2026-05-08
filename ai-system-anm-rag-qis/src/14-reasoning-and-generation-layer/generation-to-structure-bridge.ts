import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { runProblemResolutionLayerBridge } from "./problem-resolution-core/problem-resolution-layer-bridge";

const GENERATION_TO_STRUCTURE_CONTRACT = {
  from: "generation",
  to: "critical-council",
  requiredFields: ["draftResponse", "generationPrompt"],
} as const;

export function handoffGenerationToStructure(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, GENERATION_TO_STRUCTURE_CONTRACT);
  runProblemResolutionLayerBridge(state);
  state.reasonedDraft = `${state.draftResponse?.text || ""}`.trim();
  return state;
}

