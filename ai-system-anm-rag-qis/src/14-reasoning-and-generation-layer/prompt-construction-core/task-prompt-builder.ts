import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildTaskPrompt(state: ProcessingState): string {
  const conversation = state.conversationState;
  const conversationDirectives: string[] = [];

  if (conversation.activeTopic) {
    conversationDirectives.push(`Topico conversacional ativo: ${conversation.activeTopic}.`);
  }
  if (conversation.needsClarification) {
    const followUp = conversation.followUpPrompt?.trim() || "Voce pode esclarecer em uma frase o objetivo principal agora?";
    conversationDirectives.push(`Antes de concluir, faca uma pergunta curta de clarificacao: "${followUp}"`);
  }
  if (conversation.rapportScore >= 0.65) {
    conversationDirectives.push("Mantenha continuidade dialogal e tom cooperativo.");
  } else if (conversation.rapportScore <= 0.35) {
    conversationDirectives.push("Responda de forma mais objetiva e acolhedora para reduzir friccao.");
  }

  const joinedConversationDirectives =
    conversationDirectives.length > 0 ? ` Diretrizes conversacionais: ${conversationDirectives.join(" ")}` : "";

  return (
    `Tarefa: responda ao pedido do usuario sem reescrever a pergunta. Pedido atual: '${state.normalizedMessage}'. ` +
    "Entregue diretamente a resposta, com no maximo uma justificativa curta quando necessario." +
    joinedConversationDirectives
  );
}
