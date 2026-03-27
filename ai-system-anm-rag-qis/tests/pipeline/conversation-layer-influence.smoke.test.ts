import { runPipelineConductor } from "../../src/00-myelinated-pipeline-core/pipeline-conductor";

async function verifyConversationInfluence() {
  const result = await runPipelineConductor({ rawMessage: "faz isso" });
  const state = result.state;

  const conversationTrace = state.trace.find(
    (item) => item.layer === "conversation" && item.action === "conversation_state_updated",
  );
  if (!conversationTrace) {
    throw new Error("expected conversation layer trace entry");
  }

  if (!state.conversationState.needsClarification) {
    throw new Error("expected conversation layer to request clarification for ambiguous short prompt");
  }

  if (!state.conversationState.activeTopic || state.conversationState.activeTopic.trim() === "") {
    throw new Error("expected active topic from conversation layer");
  }

  if (!state.generationPrompt.includes("Diretrizes conversacionais")) {
    throw new Error("expected generation prompt to include conversational directives");
  }
}

void verifyConversationInfluence();
