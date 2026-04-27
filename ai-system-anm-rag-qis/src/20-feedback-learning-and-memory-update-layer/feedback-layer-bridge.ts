/**
 * @file feedback-layer-bridge.ts
 * @description Executa feedback e registra sinais arquiteturais de adequacao cognitiva.
 * @layer 20-feedback-learning-and-memory-update-layer
 * @purpose Alimentar memoria e feedback com erros de regime, validacao e auditoria sem retreinar pesos.
 * @inputs ProcessingState validado e PipelineAuditReport opcional.
 * @outputs ProcessingState com executionArtifacts.feedback e trace de feedback.
 * @dependsOn processing-state, trace-utils, feedback-to-memory-bridge, feedback-sql-bridge.
 * @usedBy pipeline-flow-descending apos observabilidade.
 * @invariants Feedback observa e registra padroes; nao altera resposta final nem reinicia pipeline.
 * @notes A integracao prepara aprendizado arquitetural futuro por classe de tarefa.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { handoffFeedbackToMemory } from "./feedback-to-memory-bridge";
import { runFeedbackSqlBridge } from "./feedback-sql-bridge";

function resolveCognitiveRegimeErrorPattern(state: ProcessingState): string | null {
  const validation = state.executionArtifacts.validation;
  if (state.validationReport.quality.decision !== "retry") return null;
  if (validation?.selfCritiqueFindings?.some((item) => /regime|resolver|deterministica|longa/i.test(item))) {
    return "self_critique_regime_mismatch";
  }
  if (validation?.taskClassValidationIssues?.some((item) => /restri|modo|formato|deducao/i.test(item))) {
    return "task_class_validation_mismatch";
  }
  return "generic_validation_retry";
}

export async function runFeedbackLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  handoffFeedbackToMemory(state);
  await runFeedbackSqlBridge(state);

  const cognitiveRegimeErrorPattern = resolveCognitiveRegimeErrorPattern(state);
  state.executionArtifacts.feedback = {
    cognitiveRegimeErrorPattern,
    selectedTaskType: state.taskNatureState?.selectedTaskType,
    selectedProfile: state.profileSelectionResult?.primaryProfileId,
    validationBlocked: state.validationReport.quality.decision === "retry",
    selfCritiqueFindings: state.executionArtifacts.validation?.selfCritiqueFindings || [],
    auditConfidence: state.pipelineAuditReport?.confidence,
  };

  state.trace.push(
    makeTraceEvent({
      layer: "feedback",
      action: "feedback_cycle_applied",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `decision=${state.validationReport.quality.decision}; selectedMemory=${state.memorySnapshot.selectedRecordIds.length}; ` +
        `taskType=${state.taskNatureState?.selectedTaskType || "unknown"}; profile=${state.profileSelectionResult?.primaryProfileId || "none"}; ` +
        `regimePattern=${cognitiveRegimeErrorPattern || "none"}`,
    }),
  );
  return state;
}

