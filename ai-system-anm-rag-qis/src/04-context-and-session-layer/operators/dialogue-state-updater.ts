/**
 * @file dialogue-state-updater.ts
 * @description Atualiza um DialogueState leve a partir do estado conversacional existente.
 * @layer 04-context-and-session-layer
 * @purpose Preservar continuidade dialogica sem criar memoria paralela pesada.
 * @inputs Estado anterior opcional, topico ativo, mudanca de topico e loops.
 * @outputs DialogueState atualizado.
 * @dependsOn dialogue-state.
 * @usedBy contexto, auditoria e futuras politicas de memoria.
 * @invariants Nao deve sobrescrever conversationState canonico; apenas resumir.
 * @notes Pode ser persistido futuramente pela camada de feedback.
 */
import type { DialogueState } from "../../bridges/contracts/dialogue-state";

export function updateDialogueState(input: {
  previous?: DialogueState | null;
  activeTopic: string;
  topicShiftDetected: boolean;
  openLoops?: string[];
  userStance?: string | null;
}): DialogueState {
  return {
    activeTopic: input.activeTopic || input.previous?.activeTopic || "general",
    previousTopic: input.topicShiftDetected ? input.previous?.activeTopic || null : input.previous?.previousTopic || null,
    topicShiftDetected: input.topicShiftDetected,
    continuityScore: input.topicShiftDetected ? 0.35 : 0.75,
    openLoops: input.openLoops || input.previous?.openLoops || [],
    userStance: input.userStance || input.previous?.userStance || null,
    assistantStance: input.previous?.assistantStance || null,
    dialogicalTension: input.userStance === "challenging" ? "medium" : "low",
    pendingCommitments: input.previous?.pendingCommitments || [],
    auditReasons: [`topic:${input.activeTopic}`, `shift:${input.topicShiftDetected ? "true" : "false"}`],
  };
}

