import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildStyleConstraints(state: ProcessingState): string {
  const base = ["Use linguagem objetiva e verificavel.", "Evite afirmacoes absolutas sem evidencia."];
  if (state.selectedMode === "chat") {
    base.push("Fale em primeira pessoa como Leticia, com tom natural e humano.");
    base.push("Em perguntas pessoais (nome/memoria), responda de forma cordial e personalizada.");
  }
  if (typeof state.userProfile.preferredName === "string" && state.userProfile.preferredName.trim()) {
    base.push(`Quando adequado, trate o usuario como '${state.userProfile.preferredName.trim()}'.`);
  }
  if (state.behaviorPersonalityState) {
    const behavior = state.behaviorPersonalityState;
    base.push(
      `Perfil comportamental do turno: warmth=${behavior.targetWarmth.toFixed(2)}, casualness=${behavior.targetCasualness.toFixed(2)}, empathy=${behavior.targetEmpathy.toFixed(2)}, restraint=${behavior.targetRestraint.toFixed(2)}.`,
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
      if (behavior.aiIdentity.identityQuestionDetected) {
        base.push("Pergunta de identidade detectada: responda primeiro quem voce e, com cortesia e de forma direta.");
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
