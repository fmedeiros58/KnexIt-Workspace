/**
 * @file missed-shortcut-detector.ts
 * @description Detecta quando uma tarefa simples recebeu tratamento longo demais.
 * @layer 10-reflective-layer
 * @purpose Reduzir respostas discursivas em deducoes ou respostas deterministicas curtas.
 * @inputs Tipo cognitivo e resposta candidata.
 * @outputs Sinais de atalho perdido.
 * @dependsOn cognitive-task-type.
 * @usedBy autocritica curta e validacao.
 * @invariants Nao deve encurtar tarefas que exigem grounding ou analise profunda.
 * @notes Apenas sinaliza; reparo permanece em camadas de geracao/calibracao.
 */
import type { CognitiveTaskType } from "../../bridges/contracts/cognitive-task-type";

export function detectMissedShortcut(taskType: CognitiveTaskType, answer: string): string[] {
  if ((taskType === "closed_constraint_deduction" || taskType === "short_deterministic_reasoning") && answer.length > 900) {
    return ["short_deterministic_task_answer_too_long"];
  }
  return [];
}

