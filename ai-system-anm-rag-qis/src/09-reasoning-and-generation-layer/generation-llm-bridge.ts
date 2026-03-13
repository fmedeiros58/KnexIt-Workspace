import type { ProcessingState } from "../bridges/contracts/processing-state";
import { vllmClientInfo } from "../infra/llm/vllm-client";

export async function runGenerationLlmBridge(state: ProcessingState): Promise<ProcessingState> {
  if (!state.collapsedTruth.summary && state.retrievedEvidence.length > 0) {
    state.collapsedTruth.summary = state.retrievedEvidence.slice(0, 2).join(" ");
  }

  state.userProfile = {
    ...state.userProfile,
    generationRuntime: {
      provider: "vllm-openai-compatible",
      model: vllmClientInfo.model,
      baseUrl: vllmClientInfo.baseUrl,
      maxTokens: vllmClientInfo.maxTokens,
    },
  };

  return state;
}
