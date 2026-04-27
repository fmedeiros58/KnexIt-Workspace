/**
 * @file task-nature-audit-recorder.ts
 * @description Resume a classificacao de natureza cognitiva para auditoria humana.
 * @layer 19-observability-control-and-admin-layer
 * @purpose Tornar explicitos scores, hipoteses e sinais que levaram ao tipo selecionado.
 * @inputs ProcessingState com TaskNatureState.
 * @outputs Objeto serializavel de auditoria.
 * @dependsOn bridges/contracts/processing-state.
 * @usedBy pipeline-audit-report-builder e observability-layer.
 * @invariants Nao deve reclassificar a tarefa durante a observabilidade.
 * @notes Ausencia de TaskNatureState e registrada como baixa auditabilidade.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildTaskNatureAudit(state: ProcessingState): Record<string, unknown> {
  const taskNature = state.taskNatureState;
  return {
    selectedTaskType: taskNature?.selectedTaskType || "unknown",
    confidence: taskNature?.confidence || 0,
    hypotheses: taskNature?.hypotheses.map((item) => ({
      taskType: item.taskType,
      score: item.score,
      signals: item.matchedSignals.slice(0, 5),
    })) || [],
    conversationalIntents: taskNature?.conversationalIntents || [],
  };
}

