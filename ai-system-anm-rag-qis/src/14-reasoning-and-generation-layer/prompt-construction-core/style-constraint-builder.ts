import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildStyleConstraints(state: ProcessingState): string {
  const normalizedMessage = `${state.normalizedMessage || ""}`.toLowerCase();
  const deliberative = state.generalTaskDeliberationState || state.deliberativeTaskState;
  const deliberativeActive = Boolean(deliberative?.isActive && deliberative?.reasoningContract);
  const brevityCue =
    /\b(curta e grossa|curto e grosso|objetiva|objetivo|direto|direta|sem enrolacao|so responda|apenas responda|resposta curta)\b/i.test(
      normalizedMessage,
    );

  const base = ["Use linguagem objetiva e verificavel.", "Evite afirmacoes absolutas sem evidencia."];
  base.push("Nao repita nem parafraseie a pergunta do usuario na abertura.");
  base.push("Evite preambulos do tipo 'considerando a pergunta' ou equivalentes.");
  base.push("Nao inicie com autoapresentacao ('eu sou Leticia') quando o usuario nao pediu identidade.");
  base.push("Nao explique origem/significado do nome nem expanda a narrativa identitaria interna quando o usuario nao perguntou identidade.");
  base.push("Mantenha todo o texto no mesmo idioma da conversa (padrao: portugues brasileiro).");
  base.push("Nao alternar para ingles no meio da resposta.");
  base.push("Nunca exponha metadados internos, escores, parametros numericos ou chaves tecnicas na resposta final.");

  if (state.behaviorPersonalityState.aiIdentity.identityQuestionDetected) {
    const narrative = `${state.behaviorPersonalityState.aiIdentity.identityNarrativeShort || ""}`.trim();
    if (narrative) {
      base.push(`Base identitaria oficial: ${narrative}`);
    }
  }

  if (brevityCue && !deliberativeActive) {
    base.push("Modo direto: responda em 1 a 3 frases, sem listas e sem introducao longa.");
    base.push("Entregue primeiro a resposta final.");
  }

  if (deliberativeActive) {
    base.push("Modo argumentativo estruturado ativo: nao comprima a resposta.");
    base.push("Cobertura integral das obrigacoes antes da conclusao.");
    base.push("Nao troque demonstracao por declaracoes genericas.");
    base.push("Nao exponha secoes obrigatorias, transicoes, scores, contagens ou qualquer metadado interno.");
    base.push("Prefira paragrafos densos e continuidade argumentativa; use listas apenas quando trouxerem ganho real.");
  }

  if (state.conversationState.activeTopic) {
    base.push(`Mantenha continuidade com o topico ativo da conversa: ${state.conversationState.activeTopic}.`);
  }
  if (state.conversationState.needsClarification && !deliberativeActive) {
    const followUp = state.conversationState.followUpPrompt?.trim() || "Voce pode esclarecer em uma frase o objetivo principal?";
    base.push(`Ha lacuna de contexto: inclua uma pergunta curta de clarificacao (${followUp}).`);
  }
  base.push("Nao aplique humanizacao ou personalidade expressiva nesta etapa pre-validacao.");
  if (state.complexityProfile.score >= 0.65 || deliberativeActive) {
    base.push("Estruture resposta em blocos com progressao logica.");
  }
  if (state.collapsedTruth.uncertainty > 0.4) {
    base.push("Sinalize incerteza residual explicitamente.");
  }
  return `Estilo: ${base.join(" ")}`;
}
