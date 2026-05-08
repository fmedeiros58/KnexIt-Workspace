/**
 * @file dialogue-state.ts
 * @description Define o estado dialogico canonico para continuidade de conversa.
 * @layer bridges/contracts
 * @purpose Rastrear topico, mudanca de assunto, loops abertos e tensao dialogica.
 * @inputs Historico recente, operadores de conversa e estado de sessao.
 * @outputs DialogueState.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy operadores de contexto, politicas dialeticas, validacao e auditoria.
 * @invariants O estado dialogico nao deve sobrescrever o texto original do usuario.
 * @notes Este contrato e leve para poder ser persistido ou auditado futuramente.
 */
export interface DialogueState {
  activeTopic: string;
  previousTopic: string | null;
  topicShiftDetected: boolean;
  continuityScore: number;
  openLoops: string[];
  userStance: string | null;
  assistantStance: string | null;
  dialogicalTension: "none" | "low" | "medium" | "high";
  pendingCommitments: string[];
  auditReasons: string[];
}

