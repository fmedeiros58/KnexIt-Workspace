/**
 * @file dialogue-act-classifier.ts
 * @description Classifica o ato dialogico do turno sem confundir com natureza cognitiva.
 * @layer 03-conversation-layer
 * @purpose Separar pedido, afirmacao, saudacao, correcao e continuidade.
 * @inputs Texto normalizado do usuario.
 * @outputs DialogueActClassification.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy task-nature-classifier, contexto e auditoria conversacional.
 * @invariants Dialogue act nao substitui TaskNatureState.
 * @notes Mantido simples para uso antes de chamadas caras.
 */
export interface DialogueActClassification {
  act: "greeting" | "question" | "request" | "correction" | "challenge" | "continuation" | "statement";
  confidence: number;
  signals: string[];
}

export function classifyDialogueAct(text: string): DialogueActClassification {
  const signals: string[] = [];
  if (/\b(oi|ola|ol[aá]|bom dia|boa tarde|boa noite)\b/i.test(text)) signals.push("greeting");
  if (/\?/.test(text)) signals.push("question");
  if (/\b(fa[cç]a|implemente|corrija|analise|explique|crie)\b/i.test(text)) signals.push("request");
  if (/\b(corrigindo|na verdade|o correto)\b/i.test(text)) signals.push("correction");
  if (/\b(discordo|conteste|contra-?argumente|refute)\b/i.test(text)) signals.push("challenge");
  if (/\b(alem disso|continuando|sobre isso|tambem)\b/i.test(text)) signals.push("continuation");
  const act = (signals.find((signal) => signal !== "question") || signals[0] || "statement") as DialogueActClassification["act"];
  return { act, confidence: signals.length ? 0.74 : 0.44, signals };
}

