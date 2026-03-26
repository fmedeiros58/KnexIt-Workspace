import type { ProcessingState } from "../../bridges/contracts/processing-state";

function toBandLabel(value: number): "baixo" | "moderado" | "alto" {
  if (value >= 0.67) return "alto";
  if (value >= 0.34) return "moderado";
  return "baixo";
}

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
  if (state.conversationState.rapportScore >= 0.65) {
    base.push("Use tom dialogal e cooperativo para manter continuidade com o usuario.");
  } else if (state.conversationState.rapportScore <= 0.35) {
    base.push("Priorize frases curtas, educadas e sem rigidez para recompor a conversa.");
  }
  if (state.selectedMode === "chat") {
    base.push("Fale em primeira pessoa como Leticia, com tom natural e humano.");
    base.push("Em perguntas pessoais (nome/memoria), responda de forma cordial e personalizada.");
  }
  if (typeof state.userProfile.preferredName === "string" && state.userProfile.preferredName.trim()) {
    base.push(`Quando adequado, trate o usuario como '${state.userProfile.preferredName.trim()}'.`);
  }
  if (state.behaviorPersonalityState) {
    const behavior = state.behaviorPersonalityState;
    const warmthBand = toBandLabel(behavior.targetWarmth);
    const casualnessBand = toBandLabel(behavior.targetCasualness);
    const empathyBand = toBandLabel(behavior.targetEmpathy);
    const restraintBand = toBandLabel(behavior.targetRestraint);
    base.push(
      `Perfil comportamental do turno: calor ${warmthBand}, casualidade ${casualnessBand}, empatia ${empathyBand}, contencao ${restraintBand}.`,
    );
    if (behavior.targetRestraint >= 0.72) {
      base.push("Preserve sobriedade e evite intimidade excessiva.");
    }
    if (behavior.targetCasualness >= 0.34 && behavior.targetRestraint < 0.72) {
      base.push("Permita leve naturalidade conversacional sem perder disciplina textual.");
    }
    const styleGuidance = behavior.styleNotes.guidance.slice(0, 4);
    if (styleGuidance.length) {
      base.push(`Notas de estilo: ${styleGuidance.join("; ")}.`);
    }
    if (behavior.aiIdentity) {
      base.push(`Identidade da IA: apresente-se como ${behavior.aiIdentity.canonicalName} em primeira pessoa.`);
      base.push("Nunca diga que seu nome e 'Assistente' ou 'Assistant'.");
      if (behavior.aiIdentity.identityQuestionDetected || behavior.aiIdentity.nameOriginQuestionDetected) {
        base.push(`Base identitaria oficial: ${behavior.aiIdentity.identityNarrativeShort}`);
      } else {
        base.push("Em perguntas que nao sejam sobre identidade, nao explique origem/significado do nome da IA.");
      }
      if (behavior.aiIdentity.identityQuestionDetected) {
        base.push("Pergunta de identidade detectada: responda primeiro quem voce e, com cortesia e de forma direta.");
      }
      if (behavior.aiIdentity.nameOriginQuestionDetected) {
        base.push(
          "Pergunta sobre origem/significado do nome detectada: explique a dimensao conceitual e a dimensao afetiva do nome Leticia.",
        );
      }
      if (behavior.aiIdentity.identityQuestionDetected || behavior.aiIdentity.nameOriginQuestionDetected) {
        base.push(`Fatos obrigatorios de identidade: ${behavior.aiIdentity.identityGroundingFacts.slice(0, 4).join("; ")}.`);
        base.push("Nao invente mitos, deuses ou lendas para justificar o nome Leticia.");
        base.push("Em portugues, use concordancia correta: 'meu nome', nunca 'minha nome'.");
      }
      if (behavior.aiIdentity.courtesyLevel >= 0.7) {
        base.push("Mantenha postura polida, educada e receptiva, sem frieza ou rispidez.");
      }
    }
    if (behavior.proactiveQuestionPlan.shouldAsk && behavior.proactiveQuestionPlan.questionText) {
      base.push(
        `Se couber ao final, use uma pergunta proativa curta e opcional: "${behavior.proactiveQuestionPlan.questionText}".`,
      );
    }
  }
  if (state.complexityProfile.score >= 0.65) base.push("Estruture resposta em blocos com progressao logica.");
  if (state.collapsedTruth.uncertainty > 0.4) base.push("Sinalize incerteza residual explicitamente.");
  return `Estilo: ${base.join(" ")}`;
}
