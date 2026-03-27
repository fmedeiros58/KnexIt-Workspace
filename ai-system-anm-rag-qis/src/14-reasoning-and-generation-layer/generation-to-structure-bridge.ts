import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const GENERATION_TO_STRUCTURE_CONTRACT = {
  from: "generation",
  to: "structure",
  requiredFields: ["draftResponse", "generationPrompt"],
} as const;

export function handoffGenerationToStructure(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, GENERATION_TO_STRUCTURE_CONTRACT);
  state.reasonedDraft = `${state.draftResponse?.text || ""}`.trim();
  return state;
}
