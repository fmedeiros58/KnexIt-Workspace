import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildStyleConstraints(state: ProcessingState): string {
  const normalizedMessage = `${state.normalizedMessage || ""}`.toLowerCase();
  const brevityCue = /\b(curta e grossa|curto e grosso|objetiva|objetivo|direto|direta|sem enrolacao|sem enrolação|so responda|só responda|apenas responda|resposta curta)\b/i.test(
    normalizedMessage,
  );
  const base = ["Use linguagem objetiva e verificavel.", "Evite afirmacoes absolutas sem evidencia."];
  base.push("Nao repita nem parafraseie a pergunta do usuario na abertura.");
  base.push("Evite preambulos do tipo 'considerando a pergunta' ou equivalentes.");
  base.push("Nunca exponha metadados internos, escores, parametros numericos ou chaves tecnicas na resposta final.");
  if (brevityCue) {
    base.push("Modo direto: responda em 1 a 3 frases, sem listas e sem introducao longa.");
    base.push("Nao abra com contextualizacao; entregue primeiro a resposta final.");
  }
  if (state.conversationState.activeTopic) {
    base.push(`Mantenha continuidade com o topico ativo da conversa: ${state.conversationState.activeTopic}.`);
  }
  if (state.conversationState.needsClarification) {
    const followUp = state.conversationState.followUpPrompt?.trim() || "Voce pode esclarecer em uma frase o objetivo principal?";
    base.push(`Ha lacuna de contexto: inclua uma pergunta curta de clarificacao (${followUp}).`);
  }
  // No pipeline descendente do ai-system-anm, estilo comportamental final e aplicado apenas apos validacao.
  base.push("Nao aplique humanizacao ou personalidade expressiva nesta etapa pre-validacao.");
  if (state.complexityProfile.score >= 0.65) base.push("Estruture resposta em blocos com progressao logica.");
  if (state.collapsedTruth.uncertainty > 0.4) base.push("Sinalize incerteza residual explicitamente.");
  return `Estilo: ${base.join(" ")}`;
}
